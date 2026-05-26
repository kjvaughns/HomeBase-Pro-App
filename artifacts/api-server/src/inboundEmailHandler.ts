import crypto from "node:crypto";
import type { Request, Response } from "express";
import { db } from "./db";
import { supportTickets, supportTicketMessages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

// Matches <ticket-{uuid}@homebaseproapp.com> in In-Reply-To / References headers
const TICKET_ID_RE = /ticket-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@homebaseproapp\.com/i;

/**
 * Verify a Svix webhook signature (used by Resend).
 *
 * Signed content: "{svix-id}.{svix-timestamp}.{rawBody}"
 * The webhook secret is base64-encoded; decode it before the HMAC.
 * Reject payloads with a timestamp older than 5 minutes (replay protection).
 */
function verifySvixSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const msgId = Array.isArray(headers["svix-id"])
    ? headers["svix-id"][0]
    : headers["svix-id"];
  const msgTs = Array.isArray(headers["svix-timestamp"])
    ? headers["svix-timestamp"][0]
    : headers["svix-timestamp"];
  const msgSig = Array.isArray(headers["svix-signature"])
    ? headers["svix-signature"][0]
    : headers["svix-signature"];

  if (!msgId || !msgTs || !msgSig) return false;

  const tsNum = parseInt(msgTs, 10);
  if (isNaN(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;

  const signedContent = `${msgId}.${msgTs}.${rawBody.toString()}`;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secret, "base64");
  } catch {
    secretBytes = Buffer.from(secret);
  }

  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // svix-signature can carry multiple space-separated candidates: "v1,sig1 v1,sig2"
  const candidates = msgSig.split(" ").map((s) => s.replace(/^v1,/, ""));
  return candidates.some((c) => c === expected);
}

function extractTicketId(value: string): string | null {
  const m = TICKET_ID_RE.exec(value);
  return m ? m[1] : null;
}

/**
 * POST /api/webhooks/resend/inbound
 *
 * Receives inbound email forwarded by Resend, extracts the ticket ID from the
 * In-Reply-To / References header, and saves the reply as a user message on
 * the matching support ticket.
 *
 * Must be registered BEFORE express.json() so req.body is a raw Buffer for
 * Svix signature verification.
 */
export async function handleResendInboundEmail(
  req: Request,
  res: Response,
): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    if (!Buffer.isBuffer(req.body)) {
      logger.error("[inbound-email] req.body is not a Buffer — route must be registered before express.json()");
      res.status(400).json({ error: "bad_body" });
      return;
    }
    if (!verifySvixSignature(req.body as Buffer, req.headers as Record<string, string | string[] | undefined>, secret)) {
      logger.warn("[inbound-email] signature verification failed");
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
  } else {
    logger.warn("[inbound-email] RESEND_WEBHOOK_SECRET not set — accepting without signature check");
  }

  // Parse JSON body (either already-parsed object or raw Buffer)
  let payload: unknown;
  try {
    const src = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);
    payload = JSON.parse(src);
  } catch {
    res.status(400).json({ error: "invalid_json" });
    return;
  }

  // Resend wraps inbound data under .data; handle both shapes
  const email = (payload as any)?.data ?? payload;
  const emailHeaders: Array<{ name: string; value: string }> =
    Array.isArray(email?.headers) ? email.headers : [];

  // Extract ticket ID from In-Reply-To or References
  let ticketId: string | null = null;
  for (const h of emailHeaders) {
    const name = (h.name ?? "").toLowerCase();
    if (name === "in-reply-to" || name === "references") {
      ticketId = extractTicketId(h.value ?? "");
      if (ticketId) break;
    }
  }

  if (!ticketId) {
    logger.info("[inbound-email] no ticket-id in headers, discarding");
    res.status(200).json({ discarded: true, reason: "no_ticket_id" });
    return;
  }

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) {
    logger.info({ ticketId }, "[inbound-email] ticket not found, discarding");
    res.status(200).json({ discarded: true, reason: "ticket_not_found" });
    return;
  }

  // Use plain-text body; strip quoted-reply lines ("> ...")
  const rawText: string = email?.text ?? "";
  const body = rawText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 5000);

  if (!body) {
    logger.info({ ticketId }, "[inbound-email] empty body after stripping quotes, discarding");
    res.status(200).json({ discarded: true, reason: "empty_body" });
    return;
  }

  await db.insert(supportTicketMessages).values({
    ticketId,
    senderId: ticket.userId ?? null,
    senderType: "user",
    body,
  });

  // Re-open resolved/closed tickets so admin attention is triggered
  const newStatus =
    ticket.status === "resolved" || ticket.status === "closed"
      ? "in_progress"
      : ticket.status;

  await db
    .update(supportTickets)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));

  logger.info({ ticketId, reopened: newStatus === "in_progress" }, "[inbound-email] user reply saved");
  res.status(200).json({ success: true });
}
