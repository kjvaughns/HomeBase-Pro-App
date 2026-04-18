export type ProviderResourceType = "article" | "video" | "guide" | "tool";

export interface ProviderResource {
  id: string;
  icon: string;
  title: string;
  description: string;
  type: ProviderResourceType;
  url: string;
}

const ALLOWED_TYPES: ReadonlySet<ProviderResourceType> = new Set([
  "article",
  "video",
  "guide",
  "tool",
]);

/**
 * Last-resort bundled list. Only used if both the upstream marketing feed
 * and any previously cached response are unavailable (e.g. on a cold start
 * with no network). Marketing should manage the canonical content via the
 * upstream JSON feed pointed at by PROVIDER_RESOURCES_FEED_URL.
 */
const BUNDLED_FALLBACK: ProviderResource[] = [
  {
    id: "1",
    icon: "book-open",
    title: "Getting Started on HomeBase",
    description:
      "Complete your Business Hub profile, add services with clear pricing, create a public booking link, and connect Stripe to accept payments. A complete profile receives 3x more client inquiries.",
    type: "guide",
    url: "https://homebasepro-app.lovable.app/blog/getting-started-on-homebase",
  },
  {
    id: "2",
    icon: "dollar-sign",
    title: "Setting Your Rates",
    description:
      "Research local market rates and factor in labor, materials, overhead, and a 15-20% profit margin. Update your pricing quarterly as material costs change to stay competitive and profitable.",
    type: "article",
    url: "https://homebasepro-app.lovable.app/blog/setting-your-rates",
  },
  {
    id: "3",
    icon: "star",
    title: "Winning 5-Star Reviews",
    description:
      "Send a reminder message 24 hours before arrival, arrive on time, take before-and-after photos of your work, and follow up the next day. Satisfied clients become long-term repeat clients.",
    type: "article",
    url: "https://homebasepro-app.lovable.app/blog/winning-5-star-reviews",
  },
  {
    id: "4",
    icon: "camera",
    title: "Photographing Your Work",
    description:
      "Use natural lighting and capture wide shots plus close-up detail of finished work. Before-and-after photos can increase booking rates by up to 40%. Keep your phone steady — a small tripod helps.",
    type: "guide",
    url: "https://homebasepro-app.lovable.app/blog/photographing-your-work",
  },
  {
    id: "5",
    icon: "shield",
    title: "Business Insurance Guide",
    description:
      "Maintain at least $1M general liability coverage. Add workers' comp if you have employees, and a tools-and-equipment policy for high-value gear. Upload proof of insurance in your Business Hub to build trust.",
    type: "guide",
    url: "https://homebasepro-app.lovable.app/blog/business-insurance-guide",
  },
  {
    id: "6",
    icon: "bar-chart-2",
    title: "Understanding Your Stats",
    description:
      "Your HomeBase dashboard tracks conversion rate, average job value, repeat-client rate, and total revenue. Review your stats weekly to spot trends and find opportunities to grow your business.",
    type: "tool",
    url: "https://homebasepro-app.lovable.app/blog/understanding-your-stats",
  },
  {
    id: "7",
    icon: "calendar",
    title: "Managing Your Schedule",
    description:
      "Set your business hours to control when clients can book. Use minimum advance booking windows to avoid last-minute rushes, and block personal time to maintain work-life balance.",
    type: "article",
    url: "https://homebasepro-app.lovable.app/blog/managing-your-schedule",
  },
  {
    id: "8",
    icon: "zap",
    title: "Getting Paid Faster",
    description:
      "Connect Stripe in your Business Hub to enable online payments. Require a deposit on booking links for larger jobs. Send invoices within 1 hour of job completion — faster invoicing means faster payment.",
    type: "guide",
    url: "https://homebasepro-app.lovable.app/blog/getting-paid-faster",
  },
];

const FEED_URL =
  process.env.PROVIDER_RESOURCES_FEED_URL ??
  "https://homebasepro-app.lovable.app/provider-resources.json";

const FRESH_TTL_MS = 5 * 60 * 1000; // re-fetch upstream every 5 minutes
const BUNDLED_BACKOFF_MS = 30 * 1000; // when serving bundled fallback, retry upstream at most every 30s
const STALE_UPSTREAM_BACKOFF_MS = 30 * 1000; // when serving stale upstream after a failed refresh, back off too
const FETCH_TIMEOUT_MS = 5000;

interface CacheEntry {
  resources: ProviderResource[];
  fetchedAt: number;
  source: "upstream" | "bundled";
}

let cache: CacheEntry | null = null;
let lastUpstreamAttemptAt = 0;
let inFlight: Promise<ProviderResource[]> | null = null;

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function sanitizeResource(raw: unknown): ProviderResource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    !isString(r.id) ||
    !isString(r.icon) ||
    !isString(r.title) ||
    !isString(r.description) ||
    !isString(r.type) ||
    !isString(r.url)
  ) {
    return null;
  }
  if (!ALLOWED_TYPES.has(r.type as ProviderResourceType)) return null;
  // Icon must look like a Feather glyph name (lowercase letters, digits, hyphens).
  if (!/^[a-z0-9-]{1,40}$/.test(r.icon)) return null;
  // Only allow http(s) URLs
  if (!/^https?:\/\//i.test(r.url)) return null;
  return {
    id: r.id,
    icon: r.icon,
    title: r.title,
    description: r.description,
    type: r.type as ProviderResourceType,
    url: r.url,
  };
}

function sanitizeFeed(payload: unknown): ProviderResource[] | null {
  // Accept either a bare array or { resources: [...] }
  let arr: unknown;
  if (Array.isArray(payload)) {
    arr = payload;
  } else if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as Record<string, unknown>).resources)
  ) {
    arr = (payload as Record<string, unknown>).resources;
  } else {
    return null;
  }
  const cleaned: ProviderResource[] = [];
  for (const item of arr as unknown[]) {
    const r = sanitizeResource(item);
    if (r) cleaned.push(r);
  }
  return cleaned.length > 0 ? cleaned : null;
}

async function fetchUpstream(): Promise<ProviderResource[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FEED_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("json")) return null;
    const json = (await res.json()) as unknown;
    return sanitizeFeed(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getProviderResources(): Promise<{
  resources: ProviderResource[];
  source: CacheEntry["source"];
  fetchedAt: number;
}> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < FRESH_TTL_MS) {
    return { ...cache };
  }

  // Apply a short backoff after any failed refresh so we don't hammer
  // upstream (or pay the timeout) on every request during an outage.
  // - Bundled cache: never had upstream success, backoff between retries.
  // - Stale upstream cache: TTL expired AND last refresh attempt was
  //   recent enough to assume the prior attempt failed.
  const recentlyAttempted = now - lastUpstreamAttemptAt;
  const onBundledBackoff =
    cache?.source === "bundled" && recentlyAttempted < BUNDLED_BACKOFF_MS;
  const onStaleUpstreamBackoff =
    cache?.source === "upstream" &&
    cache.fetchedAt < lastUpstreamAttemptAt &&
    recentlyAttempted < STALE_UPSTREAM_BACKOFF_MS;

  if (!inFlight && !onBundledBackoff && !onStaleUpstreamBackoff) {
    lastUpstreamAttemptAt = now;
    inFlight = (async () => {
      const upstream = await fetchUpstream();
      if (upstream) {
        cache = {
          resources: upstream,
          fetchedAt: Date.now(),
          source: "upstream",
        };
      } else if (!cache) {
        // First-ever fetch failed; seed cache with bundled fallback so the
        // app still gets a valid list. Mark as bundled so we keep retrying
        // upstream (subject to backoff) on subsequent requests instead of
        // treating it as fresh.
        cache = {
          resources: BUNDLED_FALLBACK,
          fetchedAt: 0,
          source: "bundled",
        };
      }
      return cache!.resources;
    })().finally(() => {
      inFlight = null;
    });
  }

  // If we already have a cache (upstream or bundled), serve it immediately
  // and let any in-flight refresh complete in the background.
  if (cache) {
    return { ...cache };
  }

  await inFlight;
  return { ...cache! };
}
