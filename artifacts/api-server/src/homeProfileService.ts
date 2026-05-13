import { db } from "./db";
import {
  homes,
  homeFieldChanges,
  type Home,
  type InsertHomeFieldChange,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export type ChangeSource =
  | "zillow_import"
  | "homeowner"
  | "health_score"
  | "survival_kit"
  | "provider";

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Apply an additive update to a home and record one change-log row per
 * field whose value actually changed.  Returns the updated home.
 */
export async function updateHomeWithChangeLog(params: {
  homeId: string;
  updates: Record<string, unknown>;
  source: ChangeSource;
  changedByUserId?: string | null;
  /** When true, only update fields that are currently null/empty (used by enrichment). */
  onlyIfEmpty?: boolean;
}): Promise<{ home: Home; changes: typeof homeFieldChanges.$inferSelect[] } | undefined> {
  const { homeId, updates, source, changedByUserId, onlyIfEmpty } = params;
  const [existing] = await db.select().from(homes).where(eq(homes.id, homeId));
  if (!existing) return undefined;

  const toApply: Record<string, unknown> = {};
  const changes: InsertHomeFieldChange[] = [];

  for (const [field, newValue] of Object.entries(updates)) {
    if (newValue === undefined) continue;
    const oldValue = (existing as Record<string, unknown>)[field];
    if (onlyIfEmpty && oldValue !== null && oldValue !== undefined) continue;
    const oldStr = stringify(oldValue);
    const newStr = stringify(newValue);
    if (oldStr === newStr) continue;
    toApply[field] = newValue;
    changes.push({
      homeId,
      fieldName: field,
      oldValue: oldStr,
      newValue: newStr,
      source,
      changedByUserId: changedByUserId ?? null,
    });
  }

  if (Object.keys(toApply).length === 0) return { home: existing, changes: [] };

  const updateData: Record<string, unknown> = {
    ...toApply,
    updatedAt: new Date(),
  };

  // Track who/when last touched the editable profile (only for human edits)
  if (source !== "zillow_import") {
    updateData.detailsUpdatedAt = new Date();
    if (changedByUserId) updateData.detailsUpdatedBy = changedByUserId;
  }

  const [updated] = await db
    .update(homes)
    .set(updateData)
    .where(eq(homes.id, homeId))
    .returning();

  let insertedChanges: typeof homeFieldChanges.$inferSelect[] = [];
  if (changes.length > 0) {
    insertedChanges = await db
      .insert(homeFieldChanges)
      .values(changes)
      .returning();
  }

  return { home: updated, changes: insertedChanges };
}

export async function getHomeFieldChanges(homeId: string, limit = 50) {
  return db
    .select()
    .from(homeFieldChanges)
    .where(eq(homeFieldChanges.homeId, homeId))
    .orderBy(desc(homeFieldChanges.changedAt))
    .limit(limit);
}
