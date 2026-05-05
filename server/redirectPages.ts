import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  jobs,
  appointments,
  providers,
  invoices,
} from "@shared/schema";

const APP_STORE_URL = "https://apps.apple.com/app/homebase-pro-app/id6760936703";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.homebase.app";
const HOMEPAGE_URL = "https://homebaseproapp.com";

function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/<\/script/gi, "<\\/script");
}

function formatMoney(n: unknown): string | null {
  if (n == null || n === "") return null;
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (!isFinite(num)) return null;
  return "$" + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(date: Date | string | null | undefined, time: string | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  return time ? `${dateStr} at ${time}` : dateStr;
}

const SHARED_STYLES = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;background:#0e1322;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;line-height:1.5}
  .wrap{width:100%;max-width:440px}
  .card{background:#1a2236;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:36px 28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
  .brand{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:24px}
  .brand-mark{width:28px;height:28px;border-radius:7px;background:#38AE5F;display:flex;align-items:center;justify-content:center}
  .brand-name{font-size:14px;font-weight:600;letter-spacing:0.4px;color:#e8edf6}
  .icon{width:72px;height:72px;border-radius:36px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:36px;font-weight:600;color:#fff}
  .icon.success{background:#38AE5F}
  .icon.cancelled{background:#E0856F}
  .icon.neutral{background:#3A6BFF}
  h1{font-size:22px;font-weight:700;margin-bottom:10px}
  .lede{color:#a0a8c0;font-size:15px;margin-bottom:24px}
  .summary{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px;margin-bottom:24px;text-align:left}
  .summary-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:6px 0;font-size:14px}
  .summary-row + .summary-row{border-top:1px solid rgba(255,255,255,0.05)}
  .summary-label{color:#7d8aa6;flex-shrink:0}
  .summary-value{color:#e8edf6;font-weight:500;text-align:right}
  .actions{display:flex;flex-direction:column;gap:10px}
  .btn{display:inline-block;padding:14px 22px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
  .btn-primary{background:#38AE5F;color:#fff}
  .btn-primary:hover{filter:brightness(1.08)}
  .btn-secondary{background:transparent;color:#e8edf6;border:1px solid rgba(255,255,255,0.18)}
  .btn-secondary:hover{background:rgba(255,255,255,0.04)}
  .stores{display:flex;gap:10px;justify-content:center;margin-top:6px}
  .stores .btn{flex:1;padding:12px 14px;font-size:14px}
  .small{font-size:13px;color:#6b7691;margin-top:18px}
  .spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,0.12);border-top-color:#38AE5F;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 18px}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

const BRAND_HTML = `
  <div class="brand">
    <div class="brand-mark">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9.5L12 3L21 9.5V21H15V15H9V21H3V9.5Z" fill="white"/>
      </svg>
    </div>
    <span class="brand-name">HomeBase</span>
  </div>
`;

function deepLinkScript(opts: {
  deepLink: string;
  fallback?: "stores" | "homepage" | "none";
  autoOpen?: boolean;
  delayMs?: number;
}): string {
  const { deepLink, fallback = "none", autoOpen = true, delayMs = 1500 } = opts;
  return `
<script>
(function(){
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isMobile = isAndroid || isIOS;
  var deepLink = ${safeJson(deepLink)};
  var openBtn = document.getElementById("open-app-btn");
  var desktopOnly = document.querySelectorAll("[data-desktop-only]");
  var mobileOnly = document.querySelectorAll("[data-mobile-only]");

  function show(nodes, on){
    for (var i=0;i<nodes.length;i++){ nodes[i].style.display = on ? "" : "none"; }
  }
  show(desktopOnly, !isMobile);
  show(mobileOnly, isMobile);

  if (openBtn) openBtn.href = deepLink;

  if (isMobile && ${autoOpen ? "true" : "false"}) {
    var didHide = false;
    document.addEventListener("visibilitychange", function(){
      if (document.hidden) didHide = true;
    });
    try { window.location.href = deepLink; } catch (_) {}
    ${
      fallback === "stores"
        ? `setTimeout(function(){
             if (!didHide && !document.hidden) {
               window.location.href = isIOS ? ${safeJson(APP_STORE_URL)} : ${safeJson(PLAY_STORE_URL)};
             }
           }, ${delayMs});`
        : fallback === "homepage"
        ? `setTimeout(function(){
             if (!didHide && !document.hidden) {
               window.location.href = ${safeJson(HOMEPAGE_URL)};
             }
           }, ${delayMs});`
        : ""
    }
  }
})();
</script>`;
}

function shellHtml(title: string, body: string, extraScript = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title>
<style>${SHARED_STYLES}</style>
</head>
<body>
<div class="wrap">${body}</div>
${extraScript}
</body>
</html>`;
}

// ─── Data lookups ────────────────────────────────────────────────────────────

type JobSummary = { title: string | null; provider: string | null; date: string | null; price: string | null };

async function lookupJobSummary(jobId: string): Promise<JobSummary | null> {
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) return null;
    let providerName: string | null = null;
    if (job.providerId) {
      const [p] = await db.select({ name: providers.businessName }).from(providers).where(eq(providers.id, job.providerId)).limit(1);
      providerName = p?.name ?? null;
    }
    return {
      title: job.title ?? null,
      provider: providerName,
      date: formatDateTime(job.scheduledDate, job.scheduledTime),
      price: formatMoney(job.finalPrice ?? job.estimatedPrice),
    };
  } catch {
    return null;
  }
}

async function lookupInvoiceJobId(invoiceId: string): Promise<string | null> {
  try {
    const [inv] = await db.select({ jobId: invoices.jobId }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    return inv?.jobId ?? null;
  } catch {
    return null;
  }
}

type AppointmentSummary = { service: string | null; provider: string | null; date: string | null };

async function lookupAppointmentSummary(appointmentId: string): Promise<AppointmentSummary | null> {
  try {
    const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!appt) return null;
    let providerName: string | null = null;
    if (appt.providerId) {
      const [p] = await db.select({ name: providers.businessName }).from(providers).where(eq(providers.id, appt.providerId)).limit(1);
      providerName = p?.name ?? null;
    }
    return {
      service: appt.serviceName ?? null,
      provider: providerName,
      date: formatDateTime(appt.scheduledDate, appt.scheduledTime),
    };
  } catch {
    return null;
  }
}

function summaryRows(rows: Array<{ label: string; value: string | null | undefined }>): string {
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return "";
  return `<div class="summary">${visible
    .map(
      (r) =>
        `<div class="summary-row"><span class="summary-label">${escapeHtml(r.label)}</span><span class="summary-value">${escapeHtml(r.value)}</span></div>`,
    )
    .join("")}</div>`;
}

function buildAppDeepLink(opts: {
  base: string;
  jobId?: string | null;
  appointmentId?: string | null;
  status?: string | null;
  subscription?: string | null;
  extra?: Record<string, string | null | undefined>;
}): string {
  const params = new URLSearchParams();
  if (opts.jobId) params.set("jobId", opts.jobId);
  if (opts.appointmentId) params.set("appointmentId", opts.appointmentId);
  if (opts.status) params.set("status", opts.status);
  if (opts.subscription) params.set("subscription", opts.subscription);
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      if (v) params.set(k, v);
    }
  }
  const qs = params.toString();
  return qs ? `${opts.base}?${qs}` : opts.base;
}

// ─── Page handlers ───────────────────────────────────────────────────────────

export async function paymentSuccessHandler(req: Request, res: Response): Promise<void> {
  const jobIdRaw = (req.query.jobId as string | undefined)?.trim() || null;
  let jobId = jobIdRaw;
  const invoiceId = (req.query.invoiceId as string | undefined)?.trim() || null;
  const subscription = (req.query.subscription as string | undefined)?.trim() || null;

  // If only invoiceId is present, look up its job for deep linking
  if (!jobId && invoiceId) jobId = await lookupInvoiceJobId(invoiceId);

  let summary: JobSummary | null = null;
  if (jobId) summary = await lookupJobSummary(jobId);

  const isSubscription = subscription === "success";
  const deepLink = isSubscription
    ? buildAppDeepLink({ base: "homebase://subscription", subscription: "success" })
    : buildAppDeepLink({ base: jobId ? `homebase://job/${encodeURIComponent(jobId)}` : "homebase://payment-result", jobId, status: "paid", extra: { invoiceId } });

  const titleText = isSubscription ? "Subscription Active" : "Payment Received";
  const lede = isSubscription
    ? "You're all set — your HomeBase Pro subscription is now active. Open the app to start using your Pro features."
    : "Thanks! Your payment was processed successfully.";

  const summaryHtml = summary
    ? summaryRows([
        { label: "Job", value: summary.title },
        { label: "Provider", value: summary.provider },
        { label: "Scheduled", value: summary.date },
        { label: "Amount", value: summary.price },
      ])
    : "";

  const body = `
    <div class="card">
      ${BRAND_HTML}
      <div class="icon success">&#10003;</div>
      <h1>${escapeHtml(titleText)}</h1>
      <p class="lede">${escapeHtml(lede)}</p>
      ${summaryHtml}
      <div class="actions">
        <a id="open-app-btn" class="btn btn-primary" href="${escapeHtml(deepLink)}" data-mobile-only>Open in App</a>
        <a class="btn btn-primary" href="${escapeHtml(deepLink)}" data-desktop-only>${escapeHtml(isSubscription ? "Continue" : "View Job")}</a>
        <div class="stores" data-desktop-only>
          <a class="btn btn-secondary" href="${escapeHtml(APP_STORE_URL)}">App Store</a>
          <a class="btn btn-secondary" href="${escapeHtml(PLAY_STORE_URL)}">Google Play</a>
        </div>
      </div>
      <p class="small" data-mobile-only>Didn't open automatically? Tap "Open in App" above.</p>
    </div>
  `;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(shellHtml(`${titleText} — HomeBase`, body, deepLinkScript({ deepLink, fallback: "none", autoOpen: true })));
}

export async function paymentCancelledHandler(req: Request, res: Response): Promise<void> {
  const jobId = (req.query.jobId as string | undefined)?.trim() || null;
  const invoiceId = (req.query.invoiceId as string | undefined)?.trim() || null;
  const subscription = (req.query.subscription as string | undefined)?.trim() || null;
  const returnUrlRaw = (req.query.return as string | undefined)?.trim() || null;
  // Only allow same-origin / known-safe return URLs
  let returnUrl: string | null = null;
  if (returnUrlRaw) {
    try {
      const u = new URL(returnUrlRaw, HOMEPAGE_URL);
      if (u.origin === HOMEPAGE_URL || u.hostname.endsWith("homebaseproapp.com")) {
        returnUrl = u.toString();
      }
    } catch {
      returnUrl = null;
    }
  }

  const isSubscription = subscription === "cancelled";
  const deepLink = isSubscription
    ? buildAppDeepLink({ base: "homebase://subscription", subscription: "cancelled" })
    : buildAppDeepLink({ base: jobId ? `homebase://job/${encodeURIComponent(jobId)}` : "homebase://payment-result", jobId, status: "cancelled", extra: { invoiceId } });

  const tryAgainHref = returnUrl ?? HOMEPAGE_URL;

  const body = `
    <div class="card">
      ${BRAND_HTML}
      <div class="icon cancelled">&#215;</div>
      <h1>Payment not completed</h1>
      <p class="lede">No charge was made. You can try again or come back later when you're ready.</p>
      <div class="actions">
        <a class="btn btn-primary" href="${escapeHtml(tryAgainHref)}">Try Again</a>
        <a id="open-app-btn" class="btn btn-secondary" href="${escapeHtml(deepLink)}" data-mobile-only>Back to App</a>
        <a class="btn btn-secondary" href="${escapeHtml(HOMEPAGE_URL)}" data-desktop-only>Back to Homepage</a>
      </div>
    </div>
  `;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(shellHtml("Payment Cancelled — HomeBase", body, deepLinkScript({ deepLink, fallback: "none", autoOpen: false })));
}

export async function bookingSuccessHandler(req: Request, res: Response): Promise<void> {
  const appointmentId = (req.query.appointmentId as string | undefined)?.trim() || null;
  const queryService = (req.query.service as string | undefined)?.trim() || null;
  const queryProvider = (req.query.provider as string | undefined)?.trim() || null;
  const queryDate = (req.query.date as string | undefined)?.trim() || null;

  let summary: AppointmentSummary | null = null;
  if (appointmentId) summary = await lookupAppointmentSummary(appointmentId);

  const service = summary?.service ?? queryService;
  const provider = summary?.provider ?? queryProvider;
  const date = summary?.date ?? queryDate;

  const deepLink = buildAppDeepLink({
    base: appointmentId ? `homebase://appointment/${encodeURIComponent(appointmentId)}` : "homebase://appointments",
    appointmentId,
  });

  const summaryHtml = summaryRows([
    { label: "Service", value: service },
    { label: "Provider", value: provider },
    { label: "When", value: date },
  ]);

  const body = `
    <div class="card">
      ${BRAND_HTML}
      <div class="icon success">&#10003;</div>
      <h1>Booking Confirmed</h1>
      <p class="lede">Your booking request has been sent. You'll get a confirmation as soon as the provider responds.</p>
      ${summaryHtml}
      <div class="actions">
        <a id="open-app-btn" class="btn btn-primary" href="${escapeHtml(deepLink)}" data-mobile-only>View Appointment</a>
        <a class="btn btn-primary" href="${escapeHtml(deepLink)}" data-desktop-only>Open in App</a>
        <div class="stores" data-desktop-only>
          <a class="btn btn-secondary" href="${escapeHtml(APP_STORE_URL)}">App Store</a>
          <a class="btn btn-secondary" href="${escapeHtml(PLAY_STORE_URL)}">Google Play</a>
        </div>
      </div>
      <p class="small" data-mobile-only>Didn't open automatically? Tap "View Appointment" above.</p>
    </div>
  `;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(shellHtml("Booking Confirmed — HomeBase", body, deepLinkScript({ deepLink, fallback: "none", autoOpen: true })));
}

export async function openAppHandler(req: Request, res: Response): Promise<void> {
  const jobId = (req.query.jobId as string | undefined)?.trim() || null;
  const appointmentId = (req.query.appointmentId as string | undefined)?.trim() || null;
  const status = (req.query.status as string | undefined)?.trim() || null;
  const path = (req.query.path as string | undefined)?.trim() || null;

  let base = "homebase://";
  if (path) {
    // Restrict to safe path characters
    const cleaned = path.replace(/[^a-zA-Z0-9/_\-.]/g, "");
    if (cleaned) base = `homebase://${cleaned.replace(/^\/+/, "")}`;
  } else if (jobId) {
    base = `homebase://job/${encodeURIComponent(jobId)}`;
  } else if (appointmentId) {
    base = `homebase://appointment/${encodeURIComponent(appointmentId)}`;
  }

  const deepLink = buildAppDeepLink({ base, jobId: path ? jobId : null, appointmentId: path ? appointmentId : null, status });

  const body = `
    <div class="card">
      ${BRAND_HTML}
      <div data-mobile-only>
        <div class="spinner"></div>
        <h1>Opening HomeBase...</h1>
        <p class="lede">If the app doesn't open automatically, you can install it below.</p>
        <div class="actions">
          <a id="open-app-btn" class="btn btn-primary" href="${escapeHtml(deepLink)}">Open App</a>
          <div class="stores">
            <a class="btn btn-secondary" href="${escapeHtml(APP_STORE_URL)}">App Store</a>
            <a class="btn btn-secondary" href="${escapeHtml(PLAY_STORE_URL)}">Google Play</a>
          </div>
        </div>
      </div>
      <div data-desktop-only>
        <div class="icon neutral">&#8594;</div>
        <h1>Open in the HomeBase app</h1>
        <p class="lede">HomeBase is a mobile app. Open this link on your phone, or visit our homepage to learn more.</p>
        <div class="actions">
          <a class="btn btn-primary" href="${escapeHtml(HOMEPAGE_URL)}">Visit Homepage</a>
          <div class="stores">
            <a class="btn btn-secondary" href="${escapeHtml(APP_STORE_URL)}">App Store</a>
            <a class="btn btn-secondary" href="${escapeHtml(PLAY_STORE_URL)}">Google Play</a>
          </div>
        </div>
      </div>
    </div>
  `;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(shellHtml("Open in HomeBase", body, deepLinkScript({ deepLink, fallback: "stores", autoOpen: true, delayMs: 2000 })));
}

export function registerRedirectPages(app: { get: (path: string, handler: (req: Request, res: Response) => unknown) => void }): void {
  app.get("/payment-success", (req, res) => {
    void paymentSuccessHandler(req as Request, res as Response);
  });
  app.get("/payment-cancelled", (req, res) => {
    void paymentCancelledHandler(req as Request, res as Response);
  });
  app.get("/booking-success", (req, res) => {
    void bookingSuccessHandler(req as Request, res as Response);
  });
  app.get("/open-app", (req, res) => {
    void openAppHandler(req as Request, res as Response);
  });
}
