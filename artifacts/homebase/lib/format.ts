/**
 * Shared display formatters — single source of truth for money/date/phone
 * text across the app. Replaces the ~6 local re-implementations that had
 * drifted (some showing cents, some not; some using "MMM d" vs "MMM d, yyyy").
 */

interface FormatMoneyOptions {
  /** Value is already in cents (e.g. from the DB). Default false (dollars). */
  cents?: boolean;
  /** Show cents (".00"). Default true. */
  showCents?: boolean;
  /** Use compact notation (e.g. "$1.2K"). Default false. */
  compact?: boolean;
}

export function formatMoney(amount: number | string | null | undefined, options: FormatMoneyOptions = {}): string {
  const { cents = false, showCents = true, compact = false } = options;
  const raw = typeof amount === "string" ? parseFloat(amount) : amount;
  const dollars = cents ? (raw ?? 0) / 100 : (raw ?? 0);
  const safeDollars = Number.isFinite(dollars) ? dollars : 0;
  if (compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(safeDollars);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(safeDollars);
}

type FormatDateStyle = "short" | "long" | "weekday" | "monthYear";

interface FormatDateOptions {
  style?: FormatDateStyle;
}

export function formatDate(date: string | Date | null | undefined, options: FormatDateOptions = {}): string {
  if (!date) return "";
  const { style = "short" } = options;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  switch (style) {
    case "long":
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    case "weekday":
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    case "monthYear":
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    case "short":
    default:
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return phone;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}
