interface UpcomingJobLike {
  status: string;
  scheduledDate: string | Date;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Single source of truth for what counts as an "upcoming job" on the
 * Provider Home screen (both the list and the stat tile).
 *
 * A job is upcoming iff:
 *   - status === "in_progress" (active work, regardless of date), OR
 *   - status === "scheduled" AND startOfDay(scheduledDate) >= startOfDay(now).
 *
 * Past "scheduled" jobs that were never marked completed/cancelled are
 * intentionally excluded — they still appear on their date in the
 * Schedule calendar, which renders all non-cancelled jobs by day.
 */
export function isUpcomingJob(job: UpcomingJobLike, now: Date = new Date()): boolean {
  if (job.status === "in_progress") return true;
  if (job.status !== "scheduled") return false;
  const jobDay = startOfDay(new Date(job.scheduledDate));
  const todayDay = startOfDay(now);
  return jobDay.getTime() >= todayDay.getTime();
}
