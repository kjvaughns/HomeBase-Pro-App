const ZIP_LIST_RE = /^\s*\d{5}(\s*,\s*\d{5})*\s*$/;

export function formatServiceAreaSubtitle(
  serviceCities: string[] | null | undefined,
  serviceArea: string | null | undefined
): string | null {
  const cities = (serviceCities ?? []).filter((c) => typeof c === "string" && c.trim().length > 0);
  if (cities.length > 0) {
    const shown = cities.slice(0, 3).join(", ");
    const extra = cities.length - 3;
    return extra > 0 ? `${shown} +${extra} more` : shown;
  }
  if (serviceArea && !ZIP_LIST_RE.test(serviceArea)) {
    return serviceArea;
  }
  return null;
}
