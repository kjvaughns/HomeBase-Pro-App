/**
 * Shared job-summary formatter used by every booking entry point:
 *   • provider in-app job creator (AddJobScreen)
 *   • homeowner in-app booking flow (SimpleBookingScreen)
 *   • public web booking page (server/bookingPage.ts)
 *   • server-side conversion of intake submissions into jobs
 *
 * The output is a normalized, human-readable description string that is stored
 * on the job (and surfaced in emails / notifications) so a job created by a
 * provider looks identical in shape to one created by a homeowner.
 *
 * This module is pure — no DB, no I/O — and is safe to import from both
 * the Node server and the React Native client.
 */

export interface IntakeQuestionDef {
  id: string;
  question: string;
  required?: boolean;
  type?: string;
  options?: string[] | null;
}

export interface AddOnInput {
  name: string;
  price?: number | string | null;
}

export interface JobSummaryInput {
  serviceName?: string | null;
  problemDescription?: string | null;
  intakeAnswers?: Record<string, unknown> | null;
  intakeQuestions?: IntakeQuestionDef[] | null;
  addOns?: AddOnInput[] | null;
  notes?: string | null;
}

const MAX_TITLE_LEN = 100;

/**
 * Build a stable job title from the available context. Used everywhere we
 * need a short label for a job (e.g. jobs.title). Always returns a non-empty
 * string so the column can never be null.
 */
export function getJobTitle(
  serviceName?: string | null,
  fallbackDescription?: string | null,
): string {
  const trimmedName = (serviceName ?? "").trim();
  if (trimmedName) return trimmedName.slice(0, MAX_TITLE_LEN);
  const fallback = (fallbackDescription ?? "").trim();
  if (fallback) return fallback.slice(0, MAX_TITLE_LEN);
  return "Service Request";
}

/**
 * Resolve a question label for an intake answer. When the question definitions
 * are available we use the human-readable text; otherwise we fall back to the
 * raw key (which can be a UUID or short slug). Either way the answer renders
 * as `Label: value`.
 */
export function formatIntakeAnswers(
  answers?: Record<string, unknown> | null,
  questions?: IntakeQuestionDef[] | null,
): string[] {
  if (!answers || typeof answers !== "object") return [];
  const lookup = new Map<string, string>();
  if (Array.isArray(questions)) {
    for (const q of questions) {
      if (q && typeof q.id === "string" && typeof q.question === "string") {
        lookup.set(q.id, q.question);
      }
    }
  }
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(answers)) {
    if (raw == null) continue;
    const value = String(raw).trim();
    if (!value) continue;
    const label = lookup.get(key) ?? key;
    lines.push(`${label}: ${value}`);
  }
  return lines;
}

function formatAddOnLine(addOn: AddOnInput): string {
  const name = (addOn.name ?? "").trim();
  if (!name) return "";
  const priceNum =
    addOn.price == null
      ? NaN
      : typeof addOn.price === "number"
        ? addOn.price
        : parseFloat(String(addOn.price));
  if (!isNaN(priceNum) && priceNum > 0) {
    return `${name} (+$${priceNum.toFixed(0)})`;
  }
  return name;
}

/**
 * Compose the canonical job summary string. Sections are joined with blank
 * lines and any empty section is omitted. Order is intentional — service /
 * scope first, then intake answers, then add-ons, then notes — so the same
 * answer always renders in the same place.
 */
export function formatJobSummary(input: JobSummaryInput): string {
  const sections: string[] = [];

  const serviceName = (input.serviceName ?? "").trim();
  const description = (input.problemDescription ?? "").trim();
  if (serviceName && description) {
    sections.push(`${serviceName}\n${description}`);
  } else if (serviceName) {
    sections.push(serviceName);
  } else if (description) {
    sections.push(description);
  }

  const answerLines = formatIntakeAnswers(
    input.intakeAnswers,
    input.intakeQuestions,
  );
  if (answerLines.length > 0) {
    sections.push(`Intake answers:\n${answerLines.join("\n")}`);
  }

  const addOnLines = (input.addOns ?? [])
    .map(formatAddOnLine)
    .filter((s) => s.length > 0);
  if (addOnLines.length > 0) {
    sections.push(`Add-ons:\n${addOnLines.map((l) => `• ${l}`).join("\n")}`);
  }

  const notes = (input.notes ?? "").trim();
  if (notes) {
    sections.push(`Notes:\n${notes}`);
  }

  return sections.join("\n\n");
}

/**
 * Convenience: parse a JSON string of intake answers safely. Used by the
 * server-side handlers which receive `answersJson` as either an already-parsed
 * object or a JSON-encoded string.
 */
export function parseIntakeAnswers(
  raw: unknown,
): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Convenience: parse a JSON string of intake question definitions safely.
 */
export function parseIntakeQuestions(raw: unknown): IntakeQuestionDef[] {
  if (raw == null) return [];
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (q): q is IntakeQuestionDef =>
      !!q &&
      typeof q === "object" &&
      typeof (q as IntakeQuestionDef).id === "string" &&
      typeof (q as IntakeQuestionDef).question === "string",
  );
}
