/**
 * Shared booking-policy helpers (Task #236).
 *
 * Providers configure deposit, cancellation, and reschedule policies in
 * Business Hub → Booking Policies. The values are persisted as a JSON
 * blob on `providers.bookingPolicies`. These pure helpers normalize the
 * stored shape and centralize all policy math so the booking, cancel,
 * and reschedule flows compute identically across server and client.
 */

export interface BookingPolicy {
  requireDeposit: boolean;
  depositPercent: number;
  cancellationHours: number;
  cancellationFeePercent: number;
  rescheduleHours: number;
  maxReschedules: number;
}

const DEFAULT_POLICY: BookingPolicy = {
  requireDeposit: false,
  depositPercent: 0,
  cancellationHours: 0,
  cancellationFeePercent: 0,
  rescheduleHours: 0,
  maxReschedules: 0,
};

function toInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return fallback;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.floor(n)));
}

/**
 * Tolerantly parse a stored bookingPolicies JSON blob. Missing/invalid
 * values fall back to "no policy" so existing providers with empty
 * configurations continue to behave as before.
 */
export function normalizeBookingPolicy(raw: unknown): BookingPolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_POLICY;
  const r = raw as Record<string, unknown>;
  return {
    requireDeposit: r.requireDeposit === true,
    depositPercent: clampPercent(toInt(r.depositPercent, 0)),
    cancellationHours: toInt(r.cancellationHours, 0),
    cancellationFeePercent: clampPercent(toInt(r.cancellationFeePercent, 0)),
    rescheduleHours: toInt(r.rescheduleHours, 0),
    maxReschedules: toInt(r.maxReschedules, 0),
  };
}

export function policyHasAnyRule(policy: BookingPolicy): boolean {
  return (
    (policy.requireDeposit && policy.depositPercent > 0) ||
    policy.cancellationHours > 0 ||
    policy.cancellationFeePercent > 0 ||
    policy.rescheduleHours > 0 ||
    policy.maxReschedules > 0
  );
}

/**
 * Render a one-paragraph human-readable summary of the policy. Returns
 * null when the policy is fully inactive — callers can use that to skip
 * rendering the policy card entirely.
 */
export function summarizePolicy(policy: BookingPolicy): string | null {
  if (!policyHasAnyRule(policy)) return null;
  const parts: string[] = [];
  if (policy.requireDeposit && policy.depositPercent > 0) {
    parts.push(
      `A ${policy.depositPercent}% deposit is required to confirm your booking.`,
    );
  }
  if (policy.cancellationHours > 0 || policy.cancellationFeePercent > 0) {
    if (policy.cancellationFeePercent > 0 && policy.cancellationHours > 0) {
      parts.push(
        `Cancel free up to ${policy.cancellationHours} hour${policy.cancellationHours === 1 ? "" : "s"} before. Later cancellations incur a ${policy.cancellationFeePercent}% fee.`,
      );
    } else if (policy.cancellationHours > 0) {
      parts.push(
        `Cancel free up to ${policy.cancellationHours} hour${policy.cancellationHours === 1 ? "" : "s"} before the appointment.`,
      );
    } else if (policy.cancellationFeePercent > 0) {
      parts.push(
        `Cancellations incur a ${policy.cancellationFeePercent}% fee.`,
      );
    }
  }
  if (policy.rescheduleHours > 0 || policy.maxReschedules > 0) {
    const bits: string[] = [];
    if (policy.rescheduleHours > 0) {
      bits.push(
        `up to ${policy.rescheduleHours} hour${policy.rescheduleHours === 1 ? "" : "s"} before`,
      );
    }
    if (policy.maxReschedules > 0) {
      bits.push(
        `max ${policy.maxReschedules} time${policy.maxReschedules === 1 ? "" : "s"}`,
      );
    }
    parts.push(`Reschedules allowed ${bits.join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * Convert a dollar amount (number, decimal-string, or null) to integer cents.
 * Returns 0 for null/invalid so deposit math degrades safely.
 */
export function dollarsToCents(
  v: number | string | null | undefined,
): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function computeDepositCents(
  policy: BookingPolicy,
  estimatedTotalCents: number,
): number {
  if (!policy.requireDeposit) return 0;
  if (policy.depositPercent <= 0) return 0;
  if (estimatedTotalCents <= 0) return 0;
  // Round up so the platform always recovers at least the configured percent
  // even on odd-cent totals.
  return Math.max(
    1,
    Math.ceil((estimatedTotalCents * policy.depositPercent) / 100),
  );
}

/**
 * Combine an appointment's `scheduledDate` (timestamp) with its
 * `scheduledTime` (e.g. "14:30") into a single Date representing the
 * actual appointment moment. The DB stores them separately, but
 * cancellation/reschedule windows must be measured against the true
 * appointment datetime — using date-only would treat e.g. a 6pm
 * appointment as if it were at midnight.
 */
export function combineDateAndTime(
  scheduledDate: Date | string | null | undefined,
  scheduledTime: string | null | undefined,
): Date | null {
  const base =
    scheduledDate instanceof Date
      ? new Date(scheduledDate.getTime())
      : scheduledDate
        ? new Date(scheduledDate)
        : null;
  if (!base || isNaN(base.getTime())) return null;
  if (!scheduledTime || typeof scheduledTime !== "string") return base;
  const m = scheduledTime.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return base;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  base.setHours(hh, mm, 0, 0);
  return base;
}

export interface CancellationFeeQuote {
  feeCents: number;
  insideCancellationWindow: boolean;
  hoursBefore: number;
}

export function computeCancellationFee(
  policy: BookingPolicy,
  estimatedTotalCents: number,
  scheduledAt: Date | string | null | undefined,
  now: Date = new Date(),
): CancellationFeeQuote {
  const scheduled =
    scheduledAt instanceof Date
      ? scheduledAt
      : scheduledAt
        ? new Date(scheduledAt)
        : null;
  if (!scheduled || isNaN(scheduled.getTime())) {
    return { feeCents: 0, insideCancellationWindow: false, hoursBefore: 0 };
  }
  const msUntil = scheduled.getTime() - now.getTime();
  const hoursBefore = msUntil / (1000 * 60 * 60);
  const inside =
    policy.cancellationHours > 0 && hoursBefore < policy.cancellationHours;
  if (!inside) {
    return { feeCents: 0, insideCancellationWindow: false, hoursBefore };
  }
  if (policy.cancellationFeePercent <= 0 || estimatedTotalCents <= 0) {
    return { feeCents: 0, insideCancellationWindow: true, hoursBefore };
  }
  const fee = Math.max(
    1,
    Math.ceil((estimatedTotalCents * policy.cancellationFeePercent) / 100),
  );
  return { feeCents: fee, insideCancellationWindow: true, hoursBefore };
}

export interface RescheduleCheck {
  allowed: boolean;
  reason?:
    | "inside_window"
    | "max_reschedules_reached";
  message?: string;
}

export function checkRescheduleAllowed(
  policy: BookingPolicy,
  scheduledAt: Date | string | null | undefined,
  currentRescheduleCount: number,
  now: Date = new Date(),
): RescheduleCheck {
  if (
    policy.maxReschedules > 0 &&
    currentRescheduleCount >= policy.maxReschedules
  ) {
    return {
      allowed: false,
      reason: "max_reschedules_reached",
      message: `This booking has already been rescheduled the maximum of ${policy.maxReschedules} time${policy.maxReschedules === 1 ? "" : "s"}.`,
    };
  }
  if (policy.rescheduleHours > 0) {
    const scheduled =
      scheduledAt instanceof Date
        ? scheduledAt
        : scheduledAt
          ? new Date(scheduledAt)
          : null;
    if (scheduled && !isNaN(scheduled.getTime())) {
      const hoursBefore =
        (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursBefore < policy.rescheduleHours) {
        return {
          allowed: false,
          reason: "inside_window",
          message: `Reschedules must be made at least ${policy.rescheduleHours} hour${policy.rescheduleHours === 1 ? "" : "s"} before the appointment.`,
        };
      }
    }
  }
  return { allowed: true };
}
