// Task #300 — Quick Quote pricing helpers.
// Computes a low/mid/high price range for a given custom service based on
// lot size or square footage, then asks OpenAI for a one-line pricing rationale.
// PII is intentionally never sent to OpenAI — only sqft/lot size + service name.

import { openai } from "./openai";

export interface CustomServiceLite {
  id: string;
  name: string;
  category?: string | null;
  pricingType: "fixed" | "hourly" | "range" | "tiered" | "custom";
  basePrice?: string | number | null;
  priceFrom?: string | number | null;
  priceTo?: string | number | null;
  priceTiersJson?: string | null;
  duration?: number | null;
}

export interface PriceRange {
  low: number;
  mid: number;
  high: number;
  basis: string;
}

interface PriceTier {
  label?: string;
  minSqft?: number;
  maxSqft?: number;
  price?: number;
}

const DEFAULT_LOW_FACTOR = 0.85;
const DEFAULT_HIGH_FACTOR = 1.2;

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tierForSize(tiers: PriceTier[], size: number | null): PriceTier | null {
  if (!size) return null;
  for (const t of tiers) {
    const min = t.minSqft ?? 0;
    const max = t.maxSqft ?? Infinity;
    if (size >= min && size <= max && num(t.price ?? null) != null) return t;
  }
  return null;
}

function parseTiers(json: string | null | undefined): PriceTier[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Compute a quote range for a service given the property size.
 * Falls back gracefully when size data isn't available.
 */
export function computeQuoteRange(
  service: CustomServiceLite,
  lotSizeSqft: number | null,
  livingSqft: number | null,
): PriceRange {
  const tiers = parseTiers(service.priceTiersJson);

  // Pick a property dimension that makes sense for the service category.
  const cat = (service.category || "").toLowerCase();
  const isOutdoor = /lawn|yard|landscap|snow|tree|pool|exterior/.test(cat);
  const sizeForTier = isOutdoor
    ? lotSizeSqft ?? livingSqft
    : livingSqft ?? lotSizeSqft;

  // 1. Tiered pricing — exact bracket lookup.
  const tier = tierForSize(tiers, sizeForTier);
  if (tier && num(tier.price) != null) {
    const mid = num(tier.price)!;
    return {
      low: Math.round(mid * DEFAULT_LOW_FACTOR),
      mid: Math.round(mid),
      high: Math.round(mid * DEFAULT_HIGH_FACTOR),
      basis: `Tier "${tier.label ?? `${tier.minSqft ?? 0}-${tier.maxSqft ?? "+"} sqft`}"`,
    };
  }

  // 2. Range pricing — provider already supplied a band.
  const from = num(service.priceFrom);
  const to = num(service.priceTo);
  if (from != null && to != null && to >= from) {
    return {
      low: Math.round(from),
      mid: Math.round((from + to) / 2),
      high: Math.round(to),
      basis: "Service price range",
    };
  }

  // 3. Fixed / base price — optionally area-scaled for outdoor services.
  const base = num(service.basePrice);
  if (base != null) {
    // Per-square-foot scaling for outdoor services with a known area.
    // Treats `basePrice` as the price for a baseline 5,000 sqft property
    // (a typical residential lot), then linearly scales outside the band
    // [0.5x, 3x] capped so quotes never explode for unusual properties.
    if (isOutdoor && sizeForTier && sizeForTier > 0) {
      const baseline = 5000;
      const ratio = Math.min(3, Math.max(0.5, sizeForTier / baseline));
      const scaled = base * ratio;
      return {
        low: Math.round(scaled * DEFAULT_LOW_FACTOR),
        mid: Math.round(scaled),
        high: Math.round(scaled * DEFAULT_HIGH_FACTOR),
        basis: `Base price scaled for ${sizeForTier.toLocaleString()} sqft`,
      };
    }
    return {
      low: Math.round(base * DEFAULT_LOW_FACTOR),
      mid: Math.round(base),
      high: Math.round(base * DEFAULT_HIGH_FACTOR),
      basis: service.pricingType === "hourly" ? "Hourly base rate" : "Base price",
    };
  }

  // 4. Last-resort heuristic so the screen never crashes.
  const fallback = sizeForTier && sizeForTier > 0 ? Math.max(75, Math.round(sizeForTier * 0.04)) : 150;
  return {
    low: Math.round(fallback * DEFAULT_LOW_FACTOR),
    mid: fallback,
    high: Math.round(fallback * DEFAULT_HIGH_FACTOR),
    basis: "Estimated — set a price on this service for sharper quotes",
  };
}

/**
 * Best-effort one-liner reasoning. Never sends address / PII.
 * Returns null if OpenAI is unavailable or errors.
 */
export interface PropertyContext {
  bedrooms?: number | null;
  bathrooms?: number | null;
  yearBuilt?: number | null;
  propertyType?: string | null;
}

export async function generatePricingInsight(params: {
  serviceName: string;
  category?: string | null;
  lotSizeSqft: number | null;
  livingSqft: number | null;
  range: PriceRange;
  property?: PropertyContext;
}): Promise<string | null> {
  if (!openai.apiKey) return null;
  const { serviceName, category, lotSizeSqft, livingSqft, range, property } = params;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a pricing assistant for home service providers. Reply with ONE short sentence (max 22 words) explaining the quote, referencing the most relevant property attribute. No greetings, no markdown, no addresses.",
        },
        {
          role: "user",
          content: JSON.stringify({
            service: serviceName,
            category: category ?? null,
            lotSqft: lotSizeSqft,
            livingSqft,
            bedrooms: property?.bedrooms ?? null,
            bathrooms: property?.bathrooms ?? null,
            yearBuilt: property?.yearBuilt ?? null,
            propertyType: property?.propertyType ?? null,
            quote: { low: range.low, mid: range.mid, high: range.high, basis: range.basis },
          }),
        },
      ],
      max_tokens: 70,
      temperature: 0.4,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return text || null;
  } catch (err) {
    console.warn("[quickQuoteService] insight generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
