// Helpers shared by Survival Kit, Health Score and the Profile editor for
// converting between persisted home-profile values (years, bools) and the
// bucketed strings used by the wizards.

export function yearsSince(year?: number | null): number | null {
  if (!year) return null;
  return Math.max(0, new Date().getFullYear() - year);
}

export function ageBucketFromYear(
  year?: number | null,
):
  | "0-5 years"
  | "5-10 years"
  | "10-15 years"
  | "15+ years"
  | "" {
  const age = yearsSince(year);
  if (age === null) return "";
  if (age < 5) return "0-5 years";
  if (age < 10) return "5-10 years";
  if (age < 15) return "10-15 years";
  return "15+ years";
}

export function roofAgeBucketFromYear(
  year?: number | null,
): "0-5 years" | "5-10 years" | "10-20 years" | "20+ years" | "" {
  const age = yearsSince(year);
  if (age === null) return "";
  if (age < 5) return "0-5 years";
  if (age < 10) return "5-10 years";
  if (age < 20) return "10-20 years";
  return "20+ years";
}

export function healthScoreRoofBucketFromYear(
  year?: number | null,
): "< 5 years" | "5-10 years" | "10-20 years" | "20+ years" | "" {
  const age = yearsSince(year);
  if (age === null) return "";
  if (age < 5) return "< 5 years";
  if (age < 10) return "5-10 years";
  if (age < 20) return "10-20 years";
  return "20+ years";
}

export function healthScoreSystemBucketFromYear(
  year?: number | null,
): "< 5 years" | "5-10 years" | "10-15 years" | "15+ years" | "" {
  const age = yearsSince(year);
  if (age === null) return "";
  if (age < 5) return "< 5 years";
  if (age < 10) return "5-10 years";
  if (age < 15) return "10-15 years";
  return "15+ years";
}

/**
 * Convert a wizard age bucket back to the year a system was installed.
 * Picks the midpoint of the bucket so re-loading the wizard reproduces it.
 */
export function bucketToInstalledYear(bucket: string): number | null {
  const now = new Date().getFullYear();
  switch (bucket) {
    case "0-5 years":
      return now - 2;
    case "5-10 years":
      return now - 7;
    case "10-15 years":
      return now - 12;
    case "15+ years":
      return now - 18;
    case "0-10 years":
      return now - 5;
    case "10-20 years":
      return now - 15;
    case "20+ years":
      return now - 22;
    default:
      return null;
  }
}

export function yearBuiltBucket(
  year?: number | null,
):
  | "Before 1960"
  | "1960-1980"
  | "1980-2000"
  | "After 2000"
  | "" {
  if (!year) return "";
  if (year < 1960) return "Before 1960";
  if (year < 1980) return "1960-1980";
  if (year < 2000) return "1980-2000";
  return "After 2000";
}

export function describeChangeSource(source: string): string {
  switch (source) {
    case "zillow_import":
      return "from Zillow";
    case "homeowner":
      return "by you";
    case "health_score":
      return "from Home Health Score";
    case "survival_kit":
      return "from Survival Kit";
    case "provider":
      return "by your provider";
    default:
      return source;
  }
}

export function formatChangeValue(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v === "true") return "Yes";
  if (v === "false") return "No";
  return v;
}
