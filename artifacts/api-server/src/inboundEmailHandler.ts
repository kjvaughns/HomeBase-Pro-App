import crypto from "node:crypto";
import type { Request, Response } from "express";
import { db } from "./db";
import { supportTickets, supportTicketMessages } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

// Matches <ticket-{uuid}@homebaseproapp.com> in In-Reply-To / References headers
const TICKET_ID_RE =
  /ticket-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@homebaseproapp\.com/i;

/**
 * Verify a Svix webhook signature (used by Resend).
 *
 * Algorithm:
 *   signed_content = "{svix-id}.{svix-timestamp}.{rawBody}"
 *   expected       = HMAC-SHA256(secretBytes, signed_content) → base64
 *
 * Svix secrets are delivered as "whsec_<base64>" — strip the prefix before
 * decoding. Signature comparison uses crypto.timingSafeEqual to prevent
 * timing-based attacks. Payloads older than 5 minutes are rejected.
 */
function verifySvixSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const msgId = asStr(headers["svix-id"]);
  const msgTs = asStr(headers["svix-timestamp"]);
  const msgSig = asStr(headers["svix-signature"]);

  if (!msgId || !msgTs || !msgSig) return false;

  // Replay protection: reject payloads older than 5 minutes
  const tsNum = parseInt(msgTs, 10);
  if (isNaN(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;

  // Strip "whsec_" prefix if present, then base64-decode the key
  const b64Key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(b64Key, "base64");
  } catch {
    return false;
  }

  const signedContent = `${msgId}.${msgTs}.${rawBody.toString("utf8")}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  const expectedBuf = Buffer.from(expected);

  // svix-signature can carry multiple space-separated candidates: "v1,sig1 v1,sig2"
  const candidates = msgSig.split(" ").map((s) => s.replace(/^v1,/, ""));
  return candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate);
    // Buffers must be the same length for timingSafeEqual
    if (expectedBuf.length !== candidateBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, candidateBuf);
  });
}

function asStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function extractTicketId(value: string): string | null {
  const m = TICKET_ID_RE.exec(value);
  return m ? m[1] : null;
}

/** Normalize an email address for comparison: lowercase, trim whitespace. */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Extract the sender email address from an RFC-5322 "From" value.
 * Handles both bare addresses ("user@example.com") and display-name form
 * ("Display Name <user@example.com>").
 */
function parseSenderEmail(from: string): string | null {
  const angleMatch = /<([^>]+)>/.exec(from);
  if (angleMatch) return normalizeEmail(angleMatch[1]);
  const bare = from.trim();
  if (bare.includes("@")) return normalizeEmail(bare);
  return null;
}

/**
 * POST /api/webhooks/resend/inbound
 *
 * Receives inbound email forwarded by Resend, verifies the Svix signature,
 * validates that the sender matches the original ticket submitter, and saves
 * the reply as a user message on the matching support ticket.
 *
 * Must be registered BEFORE express.json() so req.body is a raw Buffer for
 * signature verification (see app.ts).
 *
 * Setup:
 *   1. Resend dashboard → Domains → Inbound → set webhook URL to
 *      https://api.homebaseproapp.com/api/webhooks/resend/inbound
 *   2. Set RESEND_WEBHOOK_SECRET (the Svix signing secret from Resend)
 *      in Replit Secrets.
 */
export async function handleResendInboundEmail(
  req: Request,
  res: Response,
): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    logger.error(
      "[inbound-email] RESEND_WEBHOOK_SECRET is not configured — refusing inbound payload",
    );
    res.status(500).json({ error: "webhook_not_configured" });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    logger.error(
      "[inbound-email] req.body is not a Buffer — route must be registered before express.json()",
    );
    res.status(400).json({ error: "bad_body" });
    return;
  }

  const valid = verifySvixSignature(
    req.body as Buffer,
    req.headers as Record<string, string | string[] | undefined>,
    secret,
  );
  if (!valid) {
    logger.warn("[inbound-email] signature verification failed");
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  // Parse JSON body from raw Buffer
  let payload: unknown;
  try {
    payload = JSON.parse((req.body as Buffer).toString("utf8"));
  } catch {
    res.status(400).json({ error: "invalid_json" });
    return;
  }

  // Resend wraps inbound data under .data; handle both shapes
  const email = (payload as any)?.data ?? payload;
  const emailHeaders: Array<{ name: string; value: string }> = Array.isArray(
    email?.headers,
  )
    ? email.headers
    : [];

  // ── Extract ticket ID from In-Reply-To or References ─────────────────────
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

  // ── Look up the ticket ────────────────────────────────────────────────────
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

  // ── Sender ownership check ────────────────────────────────────────────────
  // Only the original ticket submitter may append messages via email reply.
  const senderEmail = parseSenderEmail(email?.from ?? "");
  if (!senderEmail || senderEmail !== normalizeEmail(ticket.email)) {
    logger.warn(
      { ticketId, senderEmail, ticketEmail: ticket.email },
      "[inbound-email] sender does not match ticket submitter, discarding",
    );
    res.status(200).json({ discarded: true, reason: "sender_mismatch" });
    return;
  }

  // ── Extract and clean plain-text body ────────────────────────────────────
  const rawText: string = email?.text ?? "";
  const body = rawText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 5000);

  if (!body) {
    logger.info(
      { ticketId },
      "[inbound-email] empty body after stripping quotes, discarding",
    );
    res.status(200).json({ discarded: true, reason: "empty_body" });
    return;
  }

  // ── Persist user reply ────────────────────────────────────────────────────
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

  logger.info(
    { ticketId, reopened: newStatus !== ticket.status },
    "[inbound-email] user reply saved",
  );
  res.status(200).json({ success: true });
}
