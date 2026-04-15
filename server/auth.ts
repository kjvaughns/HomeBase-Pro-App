import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const IS_PROD = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
  if (IS_PROD) {
    console.error(
      "[auth] CRITICAL: JWT_SECRET is not set in the production environment. " +
      "Sessions will not persist across server restarts. " +
      "Set JWT_SECRET in Replit Secrets to fix this permanently."
    );
  } else {
    console.warn("[auth] JWT_SECRET not set — using dev fallback. DO NOT use in production.");
  }
}

const _generatedSecret = randomBytes(64).toString("hex");

export const JWT_SECRET =
  process.env.JWT_SECRET || (IS_PROD ? _generatedSecret : "homebase-jwt-secret-dev-only");

export function generateToken(userId: string, role: string, tokenVersion: number): string {
  return jwt.sign({ userId, role, tv: tokenVersion }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string; role: string; tv?: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; tv?: number };
    return payload;
  } catch {
    return null;
  }
}

export const authenticateJWT: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const headerToken = raw?.startsWith("Bearer ") ? raw.slice(7) : undefined;
  const cookieToken = req.cookies?.token as string | undefined;
  const token = headerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [user] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, payload.userId));

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const claimedVersion = payload.tv ?? 0;
    if (user.tokenVersion !== claimedVersion) {
      res.status(401).json({ error: "Token revoked" });
      return;
    }
  } catch (err) {
    console.error("[auth] Token version check failed:", err);
    res.status(500).json({ error: "Authentication error" });
    return;
  }

  req.authenticatedUserId = payload.userId;
  next();
};
