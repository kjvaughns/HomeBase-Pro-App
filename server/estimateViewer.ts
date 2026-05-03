// SSR public viewer for estimates. Mirrors the simple HTML approach used
// by /providers/:slug — no JS framework, just a small inline form so the
// homeowner can Accept or Decline directly from email without auth.
import { storage } from "./storage";

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function statusBadge(status: string): string {
  const tone =
    status === "accepted" || status === "converted"
      ? "#10b981"
      : status === "declined" || status === "expired"
        ? "#ef4444"
        : status === "viewed" || status === "sent"
          ? "#3b82f6"
          : "#9ca3af";
  return `<span class="badge" style="background:${tone}1a;color:${tone};border:1px solid ${tone}33">${escapeHtml(status.toUpperCase())}</span>`;
}

function page(body: string, title = "Estimate"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0f1e;color:#fff;min-height:100vh;padding:24px}
    .wrap{max-width:640px;margin:0 auto}
    .card{background:rgba(255,255,255,0.06);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:24px;margin-bottom:16px}
    h1{font-size:22px;margin-bottom:4px}
    .muted{color:rgba(255,255,255,0.6);font-size:14px}
    .row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08)}
    .row:last-child{border-bottom:0}
    .total{font-size:20px;font-weight:600;color:#fff}
    .badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px}
    .actions{display:flex;gap:12px;margin-top:8px}
    button{flex:1;padding:14px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;border:0}
    .accept{background:#10b981;color:#fff}
    .decline{background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3)}
    .info{background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;padding:12px 16px;border-radius:12px;margin-top:12px;font-size:14px}
    .err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:12px 16px;border-radius:12px;margin-top:12px;font-size:14px}
  </style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

function errorPage(status: number, title: string, message: string) {
  return {
    status,
    html: page(
      `<div class="card"><h1>${escapeHtml(title)}</h1><p class="muted" style="margin-top:8px">${escapeHtml(message)}</p></div>`,
      title,
    ),
  };
}

export async function renderEstimateViewer(
  token: string,
): Promise<{ html: string; status: number }> {
  const estimate = await storage.getEstimateByPublicToken(token);
  if (!estimate) return errorPage(404, "Estimate not found", "This link is invalid or has been removed.");

  // Auto-mark as viewed once when first opened. We deliberately do NOT
  // update viewedAt on every refresh so the provider sees the genuine
  // first-view timestamp.
  if (estimate.status === "sent") {
    await storage.updateEstimate(estimate.id, {
      status: "viewed",
      viewedAt: new Date(),
    });
    estimate.status = "viewed" as any;
  }

  // Auto-expire if past expiresAt and still actionable.
  const now = new Date();
  if (
    estimate.expiresAt &&
    new Date(estimate.expiresAt) < now &&
    (estimate.status === "sent" || estimate.status === "viewed")
  ) {
    await storage.updateEstimate(estimate.id, {
      status: "expired",
      decidedAt: now,
    });
    estimate.status = "expired" as any;
  }

  const lineItems = await storage.getEstimateLineItems(estimate.id);
  const provider = await storage.getProvider(estimate.providerId);
  const providerName = provider?.businessName || "Service Provider";

  const decided =
    estimate.status === "accepted" ||
    estimate.status === "declined" ||
    estimate.status === "expired" ||
    estimate.status === "converted";

  const itemsHtml = lineItems
    .map(
      (li) => `
      <div class="row">
        <div>
          <div>${escapeHtml(li.name)}</div>
          <div class="muted">${Number(li.quantity ?? 1)} × ${formatMoney(li.unitPriceCents)}</div>
        </div>
        <div>${formatMoney(li.amountCents)}</div>
      </div>`,
    )
    .join("");

  const expiresLine = estimate.expiresAt
    ? `<p class="muted" style="margin-top:8px">Expires ${escapeHtml(new Date(estimate.expiresAt).toLocaleDateString())}</p>`
    : "";

  const decisionForm = decided
    ? `<div class="info">This estimate is ${escapeHtml(estimate.status)}. ${
        estimate.status === "accepted"
          ? "Your provider will be in touch shortly."
          : estimate.status === "declined"
            ? "Thanks for letting us know."
            : ""
      }</div>`
    : `
    <div class="actions">
      <button class="decline" onclick="decide('declined')">Decline</button>
      <button class="accept" onclick="decide('accepted')">Accept</button>
    </div>
    <div id="msg"></div>
    <script>
      async function decide(decision){
        document.querySelectorAll('button').forEach(b=>b.disabled=true);
        const msg=document.getElementById('msg');
        msg.innerHTML='<div class="info">Submitting...</div>';
        try{
          const r=await fetch('/api/estimates/public/${escapeHtml(token)}/decision',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({decision})
          });
          const data=await r.json().catch(()=>({}));
          if(!r.ok){ msg.innerHTML='<div class="err">'+(data.error||'Could not submit')+'</div>'; document.querySelectorAll('button').forEach(b=>b.disabled=false); return; }
          location.reload();
        }catch(e){ msg.innerHTML='<div class="err">Network error</div>'; document.querySelectorAll('button').forEach(b=>b.disabled=false); }
      }
    </script>
    `;

  const html = page(
    `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1>Estimate ${escapeHtml(estimate.estimateNumber)}</h1>
          <p class="muted">From ${escapeHtml(providerName)}</p>
          ${expiresLine}
        </div>
        ${statusBadge(estimate.status as string)}
      </div>
    </div>

    <div class="card">
      ${itemsHtml || '<p class="muted">No line items</p>'}
      <div class="row" style="border-top:1px solid rgba(255,255,255,0.15);margin-top:8px">
        <div class="total">Total</div>
        <div class="total">${formatMoney(estimate.totalCents)}</div>
      </div>
      ${estimate.notes ? `<p class="muted" style="margin-top:12px;white-space:pre-wrap">${escapeHtml(estimate.notes)}</p>` : ""}
    </div>

    <div class="card">
      ${decisionForm}
    </div>
    `,
    `Estimate ${estimate.estimateNumber}`,
  );

  return { html, status: 200 };
}
