import { db } from './db';
import { eq, and, inArray } from 'drizzle-orm';
import { appointments, homes } from '@workspace/db';

export interface CategoryScore {
  key: string;
  label: string;
  icon: string;
  lastServicedAt: string | null;
  intervalDays: number;
  daysSinceService: number | null;
  score: number;
  status: 'good' | 'due_soon' | 'overdue' | 'never';
}

export interface HomeHealthResult {
  score: number;
  categories: CategoryScore[];
  homeId: string | null;
}

const CATEGORIES: Array<{
  key: string;
  label: string;
  icon: string;
  keywords: string[];
  intervalDays: number;
  weight: number;
}> = [
  { key: 'hvac',        label: 'HVAC / Heating & Cooling', icon: 'thermometer', keywords: ['hvac','heating','cooling','ac ','air condition','furnace','heat pump','filter'], intervalDays: 180, weight: 2 },
  { key: 'plumbing',    label: 'Plumbing',                  icon: 'droplet',     keywords: ['plumb','pipe','leak','drain','water heat','faucet','toilet'],                    intervalDays: 365, weight: 2 },
  { key: 'electrical',  label: 'Electrical',                icon: 'zap',         keywords: ['electric','wiring','panel','outlet','circuit','lighting install'],               intervalDays: 365, weight: 2 },
  { key: 'lawn',        label: 'Lawn & Landscaping',        icon: 'sun',         keywords: ['lawn','mow','mowing','landscap','grass','yard','garden','trim','weed'],          intervalDays: 30,  weight: 1 },
  { key: 'cleaning',    label: 'Home Cleaning',             icon: 'home',        keywords: ['clean','deep clean','house clean','maid','pressure wash'],                       intervalDays: 90,  weight: 1 },
  { key: 'roofing',     label: 'Roof & Gutters',            icon: 'cloud',       keywords: ['roof','shingle','gutter','skylight'],                                            intervalDays: 730, weight: 2 },
  { key: 'pest',        label: 'Pest Control',              icon: 'shield',      keywords: ['pest','exterminator','termite','bug','rodent','mosquito'],                       intervalDays: 180, weight: 1 },
  { key: 'appliance',   label: 'Appliance Service',         icon: 'tool',        keywords: ['appliance','refrigerator','dishwash','washer','dryer','oven','microwave'],       intervalDays: 365, weight: 1 },
  { key: 'painting',    label: 'Painting',                  icon: 'edit-2',      keywords: ['paint','stain','caulk'],                                                         intervalDays: 1825,weight: 1 },
  { key: 'general',     label: 'General Maintenance',       icon: 'tool',        keywords: ['handyman','repair','maintenance','general'],                                     intervalDays: 180, weight: 1 },
];

function matchCategory(serviceName: string): string | null {
  const lower = (serviceName || '').toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      return cat.key;
    }
  }
  return null;
}

/**
 * Compute the Home Health Score (0–100) for a homeowner based on their
 * completed appointment history. Each tracked service category contributes
 * a weighted score based on how recently it was serviced vs. its recommended
 * interval. Uncompleted or never-serviced categories count as 0.
 */
export async function computeHomeHealth(userId: string): Promise<HomeHealthResult> {
  const [homeRow] = await db
    .select({ id: homes.id })
    .from(homes)
    .where(eq(homes.userId, userId))
    .limit(1);

  const completedStatuses = ['completed', 'paid', 'closed'];

  const apptRows = await db
    .select({
      serviceName: appointments.serviceName,
      scheduledDate: appointments.scheduledDate,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.userId, userId),
        inArray(appointments.status, completedStatuses as any),
      ),
    );

  const categoryLastDate: Record<string, Date> = {};

  for (const row of apptRows) {
    const catKey = matchCategory(row.serviceName ?? '');
    if (!catKey) continue;
    const d = new Date(row.scheduledDate);
    if (!categoryLastDate[catKey] || d > categoryLastDate[catKey]) {
      categoryLastDate[catKey] = d;
    }
  }

  const now = new Date();
  let totalWeightedScore = 0;
  let totalWeight = 0;
  const categoryScores: CategoryScore[] = [];

  for (const cat of CATEGORIES) {
    totalWeight += cat.weight;
    const lastDate = categoryLastDate[cat.key] ?? null;
    let daysSince: number | null = null;
    let score = 0;
    let status: CategoryScore['status'] = 'never';

    if (lastDate) {
      daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const ratio = Math.max(0, 1 - daysSince / cat.intervalDays);
      score = Math.round(ratio * 100);
      if (daysSince <= cat.intervalDays * 0.75) {
        status = 'good';
      } else if (daysSince <= cat.intervalDays) {
        status = 'due_soon';
      } else {
        status = 'overdue';
      }
    }

    totalWeightedScore += score * cat.weight;

    categoryScores.push({
      key: cat.key,
      label: cat.label,
      icon: cat.icon,
      lastServicedAt: lastDate ? lastDate.toISOString() : null,
      intervalDays: cat.intervalDays,
      daysSinceService: daysSince,
      score,
      status,
    });
  }

  const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

  return {
    score: overallScore,
    categories: categoryScores,
    homeId: homeRow?.id ?? null,
  };
}
