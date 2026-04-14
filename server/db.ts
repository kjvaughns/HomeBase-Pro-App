import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use Supabase as primary DB, fallback to Replit DATABASE_URL
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to configure a database?",
  );
}

// Detect Supabase from the resolved URL (covers both SUPABASE_DATABASE_URL and a Supabase-format DATABASE_URL)
const isSupabase = databaseUrl.includes("supabase");
console.log(`[db] Connecting to ${isSupabase ? "Supabase" : "Replit PostgreSQL"}`);

export const pool = new Pool({
  connectionString: databaseUrl,
  // Supabase requires SSL; Replit's internal Postgres does not use SSL so we enable only when connecting to Supabase
  ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });
