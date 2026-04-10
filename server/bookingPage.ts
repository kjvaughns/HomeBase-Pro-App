import { eq, and, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import {
  bookingLinks,
  providers,
  providerCustomServices,
  providerServices,
  services,
  reviews,
  users,
} from "@shared/schema";

type DrizzleClient = NodePgDatabase<typeof schema>;

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripEmoji(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .trim();
}

/** Serialize a value to JSON and escape </script> to prevent XSS breakout in script blocks */
function safeJsonInScript(value: unknown): string {
  return JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function renderStars(rating: number | null | undefined): string {
  const r = Math.round(rating ?? 0);
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += `<span class="star${i <= r ? " filled" : ""}">&star;</span>`;
  }
  return stars;
}

function errorPage(status: number, title: string, message: string): { html: string; status: number } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0f1e;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 48px 40px;
      text-align: center;
      max-width: 440px;
      width: 100%;
    }
    h1 { font-size: 1.6rem; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.65); line-height: 1.6; }
    .footer { margin-top: 40px; text-align: center; font-size: 0.8rem; color: rgba(255,255,255,0.3); }
    .footer a { color: rgba(255,255,255,0.45); text-decoration: none; }
  </style>
</head>
<body>
  <div>
    <div class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
    <div class="footer">Powered by <a href="https://homebaseproapp.com" target="_blank" rel="noopener">HomeBase Pro</a></div>
  </div>
</body>
</html>`;
  return { html, status };
}

export async function renderBookingPage(slug: string, db: DrizzleClient): Promise<{ html: string; status: number }> {
  // Look up booking link
  const [link] = await db
    .select()
    .from(bookingLinks)
    .where(eq(bookingLinks.slug, slug))
    .limit(1);

  if (!link) {
    return errorPage(404, "Provider not found", "This booking page does not exist. Please check the link and try again.");
  }

  if (link.isActive === false || link.status !== "active") {
    return errorPage(404, "Booking page unavailable", "This booking page is currently unavailable. Please contact the provider directly.");
  }

  // Look up provider (must be public)
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, link.providerId))
    .limit(1);

  if (!provider) {
    return errorPage(404, "Provider not found", "The provider associated with this booking page could not be found.");
  }

  // Fetch published custom services
  const customServices = await db
    .select()
    .from(providerCustomServices)
    .where(
      and(
        eq(providerCustomServices.providerId, provider.id),
        eq(providerCustomServices.isPublished, true)
      )
    );

  // Fetch catalog services via providerServices join where service isPublic = true
  const catalogServices = await db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      basePrice: services.basePrice,
      price: providerServices.price,
      providerServiceId: providerServices.id,
    })
    .from(providerServices)
    .innerJoin(services, eq(providerServices.serviceId, services.id))
    .where(
      and(
        eq(providerServices.providerId, provider.id),
        eq(services.isPublic, true)
      )
    );

  // Fetch recent reviews with reviewer first name
  const recentReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      reviewerFirstName: users.firstName,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.providerId, provider.id))
    .orderBy(desc(reviews.createdAt))
    .limit(5);

  const showPricing = link.showPricing !== false;
  const businessName = escapeHtml(provider.businessName ?? "Your Provider");
  const pageTitle = link.customTitle
    ? escapeHtml(link.customTitle)
    : `Book with ${businessName}`;
  const description = link.customDescription
    ? escapeHtml(link.customDescription)
    : escapeHtml(provider.description ?? `Book a service with ${businessName}.`);
  const avatarUrl = escapeHtml(provider.avatarUrl ?? "");
  const rating = provider.averageRating ?? provider.rating ?? 0;
  const reviewCount = provider.reviewCount ?? 0;
  const serviceAreaText = provider.serviceArea ? escapeHtml(stripEmoji(provider.serviceArea)) : "";

  // Build service options for dropdown (injected into inline script safely)
  type ServiceOption = { id: string; name: string; price: string | null };
  const serviceOptions: ServiceOption[] = [
    ...customServices.map((s) => ({
      id: `custom_${s.id}`,
      name: s.name ?? "Service",
      price: s.basePrice != null ? String(s.basePrice) : s.priceFrom != null ? String(s.priceFrom) : null,
    })),
    ...catalogServices.map((s) => ({
      id: `catalog_${s.id}`,
      name: s.name ?? "Service",
      price: s.price != null ? String(s.price) : s.basePrice != null ? String(s.basePrice) : null,
    })),
  ];

  // Build service list HTML
  const allServices = [
    ...customServices.map((s) => ({
      name: s.name ?? "Service",
      description: s.description ?? "",
      price: s.basePrice != null ? String(s.basePrice) : s.priceFrom != null ? String(s.priceFrom) : null,
    })),
    ...catalogServices.map((s) => ({
      name: s.name ?? "Service",
      description: s.description ?? "",
      price: s.price != null ? String(s.price) : s.basePrice != null ? String(s.basePrice) : null,
    })),
  ];

  const servicesHtml = allServices.length > 0
    ? allServices.map((s) => `
      <div class="service-card">
        <div class="service-info">
          <div class="service-name">${escapeHtml(s.name)}</div>
          ${s.description ? `<div class="service-desc">${escapeHtml(s.description)}</div>` : ""}
        </div>
        ${showPricing && s.price ? `<div class="service-price">$${escapeHtml(s.price)}</div>` : ""}
      </div>`).join("")
    : `<p class="no-services">Contact us to learn about our available services.</p>`;

  const reviewsHtml = recentReviews.length > 0
    ? recentReviews.map((r) => {
        const firstName = r.reviewerFirstName ? escapeHtml(r.reviewerFirstName) : "Anonymous";
        return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-stars">${renderStars(r.rating)}</div>
            <div class="review-meta">
              <span class="reviewer-name">${firstName}</span>
              <span class="review-date">${formatDate(r.createdAt)}</span>
            </div>
          </div>
          ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ""}
        </div>`;
      }).join("")
    : "";

  // JSON-LD structured data (safe for embedding — no </script> sequences expected but we escape anyway)
  const jsonLdObj = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": provider.businessName ?? "",
    "description": provider.description ?? "",
    "image": provider.avatarUrl ?? "",
    ...(reviewCount > 0 ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": rating,
        "reviewCount": reviewCount,
      },
    } : {}),
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${description}" />
  ${avatarUrl ? `<meta property="og:image" content="${avatarUrl}" />` : ""}
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${description}" />
  ${avatarUrl ? `<meta name="twitter:image" content="${avatarUrl}" />` : ""}
  <script type="application/ld+json">${safeJsonInScript(jsonLdObj)}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #F2F2F7;
      --accent: #38AE5F;
      --accent-hover: #2d9151;
      --glass-bg: #FFFFFF;
      --glass-border: rgba(0,0,0,0.08);
      --text: #111111;
      --text-muted: #6B6B6B;
      --text-dim: #ADADAD;
      --radius: 16px;
      --radius-sm: 10px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }

    .page-wrapper {
      max-width: 680px;
      margin: 0 auto;
      padding: 24px 16px 80px;
    }

    .glass {
      background: var(--glass-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius);
    }

    .provider-header {
      padding: 32px 28px;
      text-align: center;
      margin-bottom: 20px;
    }

    .avatar-wrap {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      overflow: hidden;
      margin: 0 auto 16px;
      border: 3px solid var(--accent);
      background: rgba(56,174,95,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
    }

    .business-name {
      font-size: 1.65rem;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }

    .page-title {
      font-size: 1rem;
      color: var(--accent);
      font-weight: 500;
      margin-bottom: 10px;
    }

    .provider-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      max-width: 480px;
      margin: 0 auto 16px;
    }

    .rating-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.9rem;
    }

    .star { color: var(--text-dim); font-size: 1rem; }
    .star.filled { color: #f5c518; }

    .rating-score { font-weight: 700; }
    .rating-count { color: var(--text-muted); }

    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 14px;
    }

    .section-card {
      padding: 24px;
      margin-bottom: 20px;
    }

    .service-card {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid var(--glass-border);
    }

    .service-card:last-child { border-bottom: none; }

    .service-name {
      font-weight: 600;
      font-size: 0.95rem;
      margin-bottom: 2px;
    }

    .service-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .service-price {
      font-weight: 700;
      color: var(--accent);
      white-space: nowrap;
      font-size: 0.95rem;
    }

    .no-services { color: var(--text-muted); font-size: 0.9rem; }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    @media (max-width: 480px) {
      .form-grid { grid-template-columns: 1fr; }
      .provider-header { padding: 24px 18px; }
      .section-card { padding: 18px; }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    input, select, textarea {
      background: rgba(0,0,0,0.04);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 0.95rem;
      padding: 11px 14px;
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
      width: 100%;
      -webkit-appearance: none;
      appearance: none;
    }

    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b6b6b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C%2Fsvg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
      padding-right: 36px;
    }

    select option { background: #ffffff; color: #111111; }

    textarea { resize: vertical; min-height: 90px; }

    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
    }

    input.error, select.error, textarea.error {
      border-color: #ff4d6d;
    }

    .field-error {
      font-size: 0.76rem;
      color: #ff4d6d;
      margin-top: 2px;
      display: none;
    }

    .field-error.visible { display: block; }

    .submit-btn {
      width: 100%;
      padding: 14px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 20px;
      transition: background 0.2s, transform 0.1s;
      font-family: inherit;
    }

    .submit-btn:hover { background: var(--accent-hover); }
    .submit-btn:active { transform: scale(0.99); }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .form-error {
      margin-top: 12px;
      padding: 12px 16px;
      background: rgba(255,77,109,0.12);
      border: 1px solid rgba(255,77,109,0.3);
      border-radius: var(--radius-sm);
      color: #ff4d6d;
      font-size: 0.88rem;
      display: none;
    }

    .form-error.visible { display: block; }

    .confirmation-card {
      padding: 40px 28px;
      text-align: center;
      display: none;
      margin-bottom: 20px;
    }

    .confirmation-card.visible { display: block; }

    .checkmark {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(56,174,95,0.12);
      border: 2px solid var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 2rem;
    }

    .confirmation-card h2 {
      font-size: 1.5rem;
      margin-bottom: 10px;
    }

    .confirmation-card p {
      color: var(--text-muted);
      margin-bottom: 6px;
      font-size: 0.95rem;
    }

    .summary-box {
      background: rgba(0,0,0,0.03);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      padding: 16px;
      margin: 20px 0;
      text-align: left;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.88rem;
      padding: 4px 0;
      color: var(--text-muted);
    }

    .summary-row strong { color: var(--text); }

    .app-cta {
      margin-top: 24px;
      padding: 14px 20px;
      background: rgba(56,174,95,0.07);
      border: 1px solid rgba(56,174,95,0.2);
      border-radius: var(--radius-sm);
    }

    .app-cta p {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .app-cta a {
      display: inline-block;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      transition: background 0.2s;
    }

    .app-cta a:hover { background: var(--accent-hover); }

    .review-card {
      padding: 16px 0;
      border-bottom: 1px solid var(--glass-border);
    }

    .review-card:last-child { border-bottom: none; }

    .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 6px;
    }

    .review-stars { display: flex; gap: 2px; }

    .review-meta {
      display: flex;
      gap: 10px;
      font-size: 0.82rem;
      align-items: center;
    }

    .reviewer-name { font-weight: 600; }
    .review-date { color: var(--text-muted); }

    .review-comment {
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .footer {
      text-align: center;
      padding: 32px 0 0;
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    .footer a {
      color: var(--accent);
      text-decoration: none;
    }

    .footer a:hover { text-decoration: underline; }

    .service-area {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">

    <!-- Provider Header -->
    <div class="glass provider-header">
      <div class="avatar-wrap">
        ${avatarUrl
          ? `<img src="${avatarUrl}" alt="${businessName}" loading="lazy" />`
          : `<span class="avatar-initials">${escapeHtml((provider.businessName ?? "P")[0].toUpperCase())}</span>`
        }
      </div>
      <div class="business-name">${businessName}</div>
      <div class="page-title">${pageTitle}</div>
      ${description ? `<p class="provider-desc">${description}</p>` : ""}
      ${reviewCount > 0 ? `
      <div class="rating-row">
        <div>${renderStars(Number(rating))}</div>
        <span class="rating-score">${Number(rating).toFixed(1)}</span>
        <span class="rating-count">(${reviewCount} review${reviewCount !== 1 ? "s" : ""})</span>
      </div>` : ""}
      ${serviceAreaText ? `<div class="service-area">Serving ${serviceAreaText}</div>` : ""}
    </div>

    <!-- Services Section -->
    <div class="glass section-card">
      <div class="section-label">Services</div>
      ${servicesHtml}
    </div>

    <!-- Booking Form -->
    <div class="glass section-card" id="booking-section">
      <div class="section-label">Request an Appointment</div>
      <form id="booking-form" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label for="firstName">First Name *</label>
            <input type="text" id="firstName" name="firstName" placeholder="Jane" autocomplete="given-name" />
            <span class="field-error" id="firstName-error">Please enter your first name.</span>
          </div>
          <div class="form-group">
            <label for="lastName">Last Name *</label>
            <input type="text" id="lastName" name="lastName" placeholder="Smith" autocomplete="family-name" />
            <span class="field-error" id="lastName-error">Please enter your last name.</span>
          </div>
          <div class="form-group">
            <label for="clientEmail">Email *</label>
            <input type="email" id="clientEmail" name="clientEmail" placeholder="jane@example.com" autocomplete="email" />
            <span class="field-error" id="clientEmail-error">Please enter a valid email.</span>
          </div>
          <div class="form-group">
            <label for="clientPhone">Phone</label>
            <input type="tel" id="clientPhone" name="clientPhone" placeholder="(555) 000-0000" autocomplete="tel" />
          </div>
          <div class="form-group full-width">
            <label for="serviceSelect">Service *</label>
            <select id="serviceSelect" name="serviceSelect">
              <option value="">-- Select a service --</option>
            </select>
            <span class="field-error" id="serviceSelect-error">Please select a service.</span>
          </div>
          <div class="form-group">
            <label for="preferredDate">Preferred Date *</label>
            <input type="date" id="preferredDate" name="preferredDate" />
            <span class="field-error" id="preferredDate-error">Please select a date.</span>
          </div>
          <div class="form-group">
            <label for="preferredTime">Preferred Time *</label>
            <select id="preferredTime" name="preferredTime">
              <option value="">-- Select a time --</option>
            </select>
            <span class="field-error" id="preferredTime-error">Please select a time.</span>
          </div>
          <div class="form-group full-width">
            <label for="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="Describe what you need help with..."></textarea>
          </div>
        </div>
        <button type="submit" class="submit-btn" id="submit-btn">Request Appointment</button>
        <div class="form-error" id="form-error"></div>
      </form>
    </div>

    <!-- Confirmation Card (hidden until success) -->
    <div class="glass confirmation-card" id="confirmation-card">
      <div class="checkmark">&#10003;</div>
      <h2>You're booked!</h2>
      <p>Your request has been submitted. ${businessName} will be in touch soon.</p>
      <div class="summary-box" id="summary-box"></div>
      <div class="app-cta">
        <p>Track your appointment and get updates in the HomeBase Pro app.</p>
        <a href="https://apps.apple.com/app/homebase-pro/id6739456140" target="_blank" rel="noopener">Download on the App Store</a>
      </div>
    </div>

    ${recentReviews.length > 0 ? `
    <!-- Reviews Section -->
    <div class="glass section-card">
      <div class="section-label">Recent Reviews</div>
      ${reviewsHtml}
    </div>` : ""}

    <div class="footer">
      Powered by <a href="https://homebaseproapp.com" target="_blank" rel="noopener">HomeBase Pro</a>
    </div>
  </div>

  <script>
    (function() {
      var slug = ${safeJsonInScript(slug)};
      var serviceOptions = ${safeJsonInScript(serviceOptions)};
      var showPricing = ${showPricing ? "true" : "false"};

      // Populate service dropdown
      var serviceSelect = document.getElementById('serviceSelect');
      serviceOptions.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name + (showPricing && s.price ? ' \u2014 $' + s.price : '');
        serviceSelect.appendChild(opt);
      });

      // Populate time dropdown (8:00 AM - 8:00 PM, 30-min increments)
      var timeSelect = document.getElementById('preferredTime');
      for (var h = 8; h <= 20; h++) {
        for (var m = 0; m < 60; m += 30) {
          if (h === 20 && m > 0) break;
          var hour12 = h % 12 || 12;
          var ampm = h < 12 ? 'AM' : 'PM';
          var minStr = m === 0 ? '00' : '30';
          var label = hour12 + ':' + minStr + ' ' + ampm;
          var value = (h < 10 ? '0' : '') + h + ':' + minStr;
          var opt = document.createElement('option');
          opt.value = value;
          opt.textContent = label;
          timeSelect.appendChild(opt);
        }
      }

      // Set min date to today
      var today = new Date();
      var yyyy = today.getFullYear();
      var mm = String(today.getMonth() + 1).padStart(2, '0');
      var dd = String(today.getDate()).padStart(2, '0');
      document.getElementById('preferredDate').min = yyyy + '-' + mm + '-' + dd;

      // Validation helpers
      function setError(fieldId, show) {
        var el = document.getElementById(fieldId);
        var err = document.getElementById(fieldId + '-error');
        if (show) {
          el.classList.add('error');
          if (err) err.classList.add('visible');
        } else {
          el.classList.remove('error');
          if (err) err.classList.remove('visible');
        }
      }

      function clearErrors() {
        ['firstName','lastName','clientEmail','serviceSelect','preferredDate','preferredTime'].forEach(function(id) {
          setError(id, false);
        });
        var fe = document.getElementById('form-error');
        fe.classList.remove('visible');
        fe.textContent = '';
      }

      function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      }

      function validate(data) {
        var valid = true;
        if (!data.firstName.trim()) { setError('firstName', true); valid = false; }
        if (!data.lastName.trim()) { setError('lastName', true); valid = false; }
        if (!data.clientEmail.trim() || !isValidEmail(data.clientEmail.trim())) {
          setError('clientEmail', true); valid = false;
        }
        if (!data.serviceId) { setError('serviceSelect', true); valid = false; }
        if (!data.date) { setError('preferredDate', true); valid = false; }
        if (!data.time) { setError('preferredTime', true); valid = false; }
        return valid;
      }

      function escHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      // Form submit
      document.getElementById('booking-form').addEventListener('submit', function(e) {
        e.preventDefault();
        clearErrors();

        var firstName = document.getElementById('firstName').value;
        var lastName = document.getElementById('lastName').value;
        var clientEmail = document.getElementById('clientEmail').value;
        var clientPhone = document.getElementById('clientPhone').value;
        var serviceSelectEl = document.getElementById('serviceSelect');
        var serviceId = serviceSelectEl.value;
        var serviceLabel = serviceSelectEl.selectedIndex >= 0 ? serviceSelectEl.options[serviceSelectEl.selectedIndex].textContent : '';
        var date = document.getElementById('preferredDate').value;
        var timeSelectEl = document.getElementById('preferredTime');
        var time = timeSelectEl.value;
        var timeLabel = timeSelectEl.selectedIndex >= 0 ? timeSelectEl.options[timeSelectEl.selectedIndex].textContent : '';
        var notes = document.getElementById('notes').value;

        var data = { firstName: firstName, lastName: lastName, clientEmail: clientEmail, clientPhone: clientPhone, serviceId: serviceId, serviceLabel: serviceLabel, date: date, time: time, notes: notes };

        if (!validate(data)) return;

        var btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        var body = {
          clientName: firstName.trim() + ' ' + lastName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: clientPhone.trim() || undefined,
          problemDescription: notes.trim() || serviceLabel.replace(/\s*\u2014\s*\$[\d.]+$/, '').trim(),
          preferredTimesJson: JSON.stringify([{ date: date, time: time }]),
        };

        fetch('/api/providers/' + slug + '/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(function(res) {
            if (!res.ok) {
              return res.text().then(function(text) {
                var msg = 'Submission failed. Please try again.';
                try { var j = JSON.parse(text); msg = j.error || msg; } catch (_) {}
                throw new Error(msg);
              });
            }
            return res.json();
          })
          .then(function() {
            document.getElementById('booking-section').style.display = 'none';

            var summary = document.getElementById('summary-box');
            summary.innerHTML =
              '<div class="summary-row"><span>Name</span><strong>' + escHtml(firstName + ' ' + lastName) + '</strong></div>' +
              '<div class="summary-row"><span>Email</span><strong>' + escHtml(clientEmail) + '</strong></div>' +
              (clientPhone.trim() ? '<div class="summary-row"><span>Phone</span><strong>' + escHtml(clientPhone) + '</strong></div>' : '') +
              '<div class="summary-row"><span>Service</span><strong>' + escHtml(serviceLabel) + '</strong></div>' +
              '<div class="summary-row"><span>Date</span><strong>' + escHtml(date) + '</strong></div>' +
              '<div class="summary-row"><span>Time</span><strong>' + escHtml(timeLabel) + '</strong></div>';

            document.getElementById('confirmation-card').classList.add('visible');
          })
          .catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Request Appointment';
            var fe = document.getElementById('form-error');
            fe.textContent = err.message || 'Something went wrong. Please try again.';
            fe.classList.add('visible');
          });
      });
    })();
  </script>
</body>
</html>`;

  return { html, status: 200 };
}
