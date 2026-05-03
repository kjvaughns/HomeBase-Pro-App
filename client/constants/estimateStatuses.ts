export const ESTIMATE_TERMINAL_STATUSES = new Set([
  "accepted",
  "declined",
  "expired",
  "converted",
]);

export const ESTIMATE_OUTSTANDING_STATUSES = new Set(["sent", "viewed"]);

export type EstimateStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired"
  | "converted";

export function estimateStatusLabel(status: string): string {
  switch (status) {
    case "draft": return "Draft";
    case "sent": return "Sent";
    case "viewed": return "Viewed";
    case "accepted": return "Accepted";
    case "declined": return "Declined";
    case "expired": return "Expired";
    case "converted": return "Converted";
    default: return status;
  }
}

export function estimateStatusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "accepted":
    case "converted":
      return "success";
    case "declined":
    case "expired":
      return "danger";
    case "sent":
    case "viewed":
      return "info";
    default:
      return "neutral";
  }
}
