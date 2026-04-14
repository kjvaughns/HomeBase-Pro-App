import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction, RequestHandler } from "express";

const FALLBACK_SECRET = "homebase-jwt-secret-change-in-production";

export const JWT_SECRET =
  process.env.JWT_SECRET || FALLBACK_SECRET;

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "SECURITY ERROR: JWT_SECRET environment variable is not set. " +
      "Using insecure fallback secret in production. " +
      "Set JWT_SECRET immediately to prevent token forgery attacks."
    );
  } else {
    console.warn(
      "[auth] JWT_SECRET not set — using dev fallback. Set JWT_SECRET in production."
    );
  }
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    return payload;
  } catch {
    return null;
  }
}

export const authenticateJWT: RequestHandler = (
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

  req.authenticatedUserId = payload.userId;
  next();
};
