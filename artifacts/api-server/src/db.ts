import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@workspace/db";

const { Pool } = pg;

// Supabase is the only supported backend database. The Replit-managed
// DATABASE_URL is intentionally NOT a fallback — pointing the app at the
// wrong DB silently corrupts data, and we have been bitten by that.
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL must be set. HomeBase uses Supabase as its only database.",
  );
}

console.log(`[db] Connecting to Supabase`);

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
