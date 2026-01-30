import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use DATABASE_URL (Replit database) - schema is synced here via db:push
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to configure a database?",
  );
}

export const pool = new Pool({ 
  connectionString: databaseUrl,
});
export const db = drizzle(pool, { schema });
