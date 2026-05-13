import { haversineMiles } from "./lib/distance";
import { geocodeAddress } from "./housefaxService";

export interface RoutePoint {
  lat: number;
  lng: number;
  address: string;
}

export interface RouteStop extends RoutePoint {
  jobId: string;
  title: string;
  scheduledTime: string | null;
  clientName: string | null;
  etaMinutesFromPrev: number;
  distanceMilesFromPrev: number;
}

export interface OptimizedRoute {
  origin: RoutePoint;
  stops: RouteStop[];
  totalMinutes: number;
  totalMiles: number;
  driveTimeSource: "google" | "haversine";
}

/**
 * Average inter-stop driving speed used for haversine fallback when no
 * Google Distance Matrix key is configured. 30 mph is conservative for a
 * mix of urban and suburban service routes.
 */
const FALLBACK_SPEED_MPH = 30;
const FALLBACK_DETOUR_FACTOR = 1.35;

interface DistanceLeg {
  distanceMiles: number;
  durationMinutes: number;
}

/**
 * Best-effort leg lookup. Tries the Google Distance Matrix API when a key
 * is configured; otherwise falls back to haversine + a detour factor.
 */
async function getLeg(
  from: RoutePoint,
  to: RoutePoint,
  apiKey: string | undefined,
): Promise<DistanceLeg & { source: "google" | "haversine" }> {
  if (apiKey) {
    try {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
      );
      url.searchParams.set("origins", `${from.lat},${from.lng}`);
      url.searchParams.set("destinations", `${to.lat},${to.lng}`);
      url.searchParams.set("units", "imperial");
      url.searchParams.set("key", apiKey);
      const r = await fetch(url.toString());
      const data = (await r.json()) as {
        status?: string;
        rows?: {
          elements?: {
            status?: string;
            distance?: { value: number };
            duration?: { value: number };
          }[];
        }[];
      };
      const el = data.rows?.[0]?.elements?.[0];
      if (data.status === "OK" && el?.status === "OK" && el.distance && el.duration) {
        return {
          distanceMiles: el.distance.value / 1609.344,
          durationMinutes: el.duration.value / 60,
          source: "google",
        };
      }
    } catch (err) {
      console.error("[routeOptimizer] Distance Matrix error:", err);
    }
  }
  const miles = haversineMiles(from.lat, from.lng, to.lat, to.lng) *
    FALLBACK_DETOUR_FACTOR;
  return {
    distanceMiles: miles,
    durationMinutes: (miles / FALLBACK_SPEED_MPH) * 60,
    source: "haversine",
  };
}

export interface JobInput {
  jobId: string;
  title: string;
  scheduledTime: string | null;
  clientName: string | null;
  address: string;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Resolve each job's lat/lng. Skips jobs that have no usable address and
 * no coordinates so the caller can show them as "needs address".
 */
export async function geocodeJobs(
  jobs: JobInput[],
): Promise<{ resolved: (JobInput & RoutePoint)[]; missing: JobInput[] }> {
  const resolved: (JobInput & RoutePoint)[] = [];
  const missing: JobInput[] = [];
  for (const j of jobs) {
    if (typeof j.lat === "number" && typeof j.lng === "number") {
      resolved.push({ ...j, lat: j.lat, lng: j.lng, address: j.address });
      continue;
    }
    if (!j.address || j.address.trim().length < 3) {
      missing.push(j);
      continue;
    }
    const g = await geocodeAddress(j.address);
    if (!g) {
      missing.push(j);
      continue;
    }
    resolved.push({
      ...j,
      lat: g.latitude,
      lng: g.longitude,
      address: g.formattedAddress,
    });
  }
  return { resolved, missing };
}

/**
 * Greedy nearest-neighbor TSP starting from `origin`. For ≤25 stops this is
 * good enough and runs in milliseconds; we'd switch to 2-opt only if route
 * sizes routinely exceed that.
 */
function nearestNeighborOrder(
  origin: RoutePoint,
  points: (JobInput & RoutePoint)[],
): (JobInput & RoutePoint)[] {
  const remaining = points.slice();
  const ordered: (JobInput & RoutePoint)[] = [];
  let current: RoutePoint = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      const d = haversineMiles(current.lat, current.lng, p.lat, p.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = next;
  }
  return ordered;
}

/**
 * Build an optimized (or manually-ordered) route with per-leg drive times.
 *
 * @param manualOrder When provided, jobs are placed in this jobId order
 *   (skipping any IDs not in `jobs`). Otherwise nearest-neighbor is used.
 */
export async function buildRoute(opts: {
  origin: RoutePoint;
  jobs: (JobInput & RoutePoint)[];
  manualOrder?: string[];
}): Promise<OptimizedRoute> {
  const apiKey = process.env.GOOGLE_API_KEY;
  let ordered: (JobInput & RoutePoint)[];
  if (opts.manualOrder && opts.manualOrder.length > 0) {
    const byId = new Map(opts.jobs.map((j) => [j.jobId, j]));
    ordered = [];
    for (const id of opts.manualOrder) {
      const j = byId.get(id);
      if (j) {
        ordered.push(j);
        byId.delete(id);
      }
    }
    // Append any remaining jobs (e.g., newly added) using nearest-neighbor
    // from the last manually-ordered point to keep the order stable.
    const tail = Array.from(byId.values());
    if (tail.length > 0) {
      const tailOrigin: RoutePoint =
        ordered.length > 0 ? ordered[ordered.length - 1] : opts.origin;
      ordered.push(...nearestNeighborOrder(tailOrigin, tail));
    }
  } else {
    ordered = nearestNeighborOrder(opts.origin, opts.jobs);
  }

  const stops: RouteStop[] = [];
  let totalMiles = 0;
  let totalMinutes = 0;
  let prev: RoutePoint = opts.origin;
  let source: "google" | "haversine" = "haversine";
  for (const p of ordered) {
    const leg = await getLeg(prev, p, apiKey);
    if (leg.source === "google") source = "google";
    totalMiles += leg.distanceMiles;
    totalMinutes += leg.durationMinutes;
    stops.push({
      jobId: p.jobId,
      title: p.title,
      scheduledTime: p.scheduledTime,
      clientName: p.clientName,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
      distanceMilesFromPrev: leg.distanceMiles,
      etaMinutesFromPrev: leg.durationMinutes,
    });
    prev = p;
  }

  return {
    origin: opts.origin,
    stops,
    totalMiles,
    totalMinutes,
    driveTimeSource: source,
  };
}
