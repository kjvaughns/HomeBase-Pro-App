import { db } from './db';
import { eq } from 'drizzle-orm';
import { providers } from '@workspace/db';

/**
 * Update a provider's booking streak when a job is completed or scheduled.
 *
 * Logic (computed lazily per UTC day):
 *  - If lastStreakDate is today → already counted, no-op.
 *  - If lastStreakDate is yesterday → extend streak by 1.
 *  - Otherwise (null or older than yesterday) → reset streak to 1.
 *
 * The effective streak that should be displayed is:
 *  - currentBookingStreak if lastStreakDate is today or yesterday
 *  - 0 if lastStreakDate is older (streak broken by inactivity)
 *
 * Call this fire-and-forget; errors are caught internally.
 */
export async function updateProviderStreak(providerId: string): Promise<void> {
  try {
    const todayUtc = utcDateStr(new Date());

    const [row] = await db
      .select({
        currentBookingStreak: providers.currentBookingStreak,
        lastStreakDate: providers.lastStreakDate,
      })
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    if (!row) return;

    const lastDate = row.lastStreakDate
      ? utcDateStr(new Date(row.lastStreakDate))
      : null;

    if (lastDate === todayUtc) {
      return;
    }

    const yesterdayUtc = utcDateStr(daysAgo(1));
    const newStreak =
      lastDate === yesterdayUtc
        ? (row.currentBookingStreak ?? 0) + 1
        : 1;

    await db
      .update(providers)
      .set({
        currentBookingStreak: newStreak,
        lastStreakDate: new Date(`${todayUtc}T00:00:00Z`),
      })
      .where(eq(providers.id, providerId));
  } catch (err) {
    console.error('[streakService] updateProviderStreak error:', {
      providerId,
      err: String(err),
    });
  }
}

/**
 * Return the effective streak for display. If the provider had job activity
 * today or yesterday the stored value is still valid; otherwise the streak is
 * considered broken (returns 0).
 */
export function effectiveStreak(currentStreak: number, lastStreakDate: Date | null | undefined): number {
  if (!lastStreakDate || currentStreak <= 0) return 0;
  const todayUtc = utcDateStr(new Date());
  const yesterdayUtc = utcDateStr(daysAgo(1));
  const lastDate = utcDateStr(new Date(lastStreakDate));
  if (lastDate === todayUtc || lastDate === yesterdayUtc) return currentStreak;
  return 0;
}

function utcDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
