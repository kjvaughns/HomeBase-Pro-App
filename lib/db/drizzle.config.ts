import { defineConfig } from "drizzle-kit";
import path from "path";

// Supabase is the only supported backend database (see artifacts/api-server/src/db.ts).
// The Replit-managed DATABASE_URL is intentionally NOT a fallback — pointing schema
// pushes at the wrong DB silently corrupts data.
if (!process.env.SUPABASE_DATABASE_URL) {
  throw new Error(
    "SUPABASE_DATABASE_URL must be set. HomeBase uses Supabase as its only database.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_DATABASE_URL,
  },
});
