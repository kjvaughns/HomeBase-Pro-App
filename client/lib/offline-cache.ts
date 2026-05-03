import AsyncStorage from "@react-native-async-storage/async-storage";

const SCHEDULE_KEY_PREFIX = "@homebase/offline_schedule:";
const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HORIZON_DAYS = 7;

export interface OfflineScheduleSnapshot<TJob, TClient> {
  jobs: TJob[];
  clients: TClient[];
  savedAt: number;
}

function scheduleKey(providerId: string): string {
  return `${SCHEDULE_KEY_PREFIX}${providerId}`;
}

interface JobLike {
  scheduledDate?: string | null;
}

function withinHorizon(job: JobLike, now: Date): boolean {
  if (!job.scheduledDate) return false;
  const when = new Date(job.scheduledDate);
  if (Number.isNaN(when.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizonEnd = new Date(startOfToday);
  horizonEnd.setDate(horizonEnd.getDate() + HORIZON_DAYS);
  return when >= startOfToday && when < horizonEnd;
}

export async function saveScheduleSnapshot<TJob extends JobLike, TClient>(
  providerId: string,
  jobs: TJob[],
  clients: TClient[],
): Promise<void> {
  if (!providerId) return;
  const now = new Date();
  const trimmedJobs = jobs.filter((j) => withinHorizon(j, now));
  const payload: OfflineScheduleSnapshot<TJob, TClient> = {
    jobs: trimmedJobs,
    clients,
    savedAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(scheduleKey(providerId), JSON.stringify(payload));
  } catch {
    // Storage failures are non-fatal — the user just won't have offline data.
  }
}

export async function loadScheduleSnapshot<TJob, TClient>(
  providerId: string,
): Promise<OfflineScheduleSnapshot<TJob, TClient> | null> {
  if (!providerId) return null;
  try {
    const raw = await AsyncStorage.getItem(scheduleKey(providerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineScheduleSnapshot<TJob, TClient>;
    if (typeof parsed?.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > SNAPSHOT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatLastUpdated(savedAt: number, nowMs: number = Date.now()): string {
  const diffMs = Math.max(0, nowMs - savedAt);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
