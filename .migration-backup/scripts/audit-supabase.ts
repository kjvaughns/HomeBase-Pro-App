import pg from "pg";
import * as schema from "../shared/schema";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";

const { Client } = pg;

async function main() {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) throw new Error("no DB url");
  const client = new Client({ connectionString: url, ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined });
  await client.connect();

  const tablesRes = await client.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  const liveTables = new Set(tablesRes.rows.map(r => r.table_name));

  const colsRes = await client.query<{ table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null }>(`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
  const liveCols = new Map<string, Map<string, any>>();
  for (const r of colsRes.rows) {
    if (!liveCols.has(r.table_name)) liveCols.set(r.table_name, new Map());
    liveCols.get(r.table_name)!.set(r.column_name, r);
  }

  const enumRes = await client.query<{ name: string; label: string }>(`SELECT t.typname AS name, e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname, e.enumsortorder`);
  const liveEnums = new Map<string, string[]>();
  for (const r of enumRes.rows) {
    if (!liveEnums.has(r.name)) liveEnums.set(r.name, []);
    liveEnums.get(r.name)!.push(r.label);
  }

  const fkRes = await client.query<{ table_name: string }>(`
    SELECT tc.table_name FROM information_schema.table_constraints tc
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`);
  const idxRes = await client.query<{ tablename: string }>(`SELECT tablename FROM pg_indexes WHERE schemaname='public'`);

  const expectedTables = new Map<string, { cols: Map<string, any> }>();
  const expectedEnums = new Map<string, readonly string[]>();
  for (const [k, v] of Object.entries(schema)) {
    if (!v) continue;
    if (is(v as any, PgTable)) {
      const cfg = getTableConfig(v as any);
      const colMap = new Map<string, any>();
      for (const c of cfg.columns) {
        colMap.set(c.name, { name: c.name, dataType: c.dataType, columnType: c.columnType, notNull: c.notNull });
      }
      expectedTables.set(cfg.name, { cols: colMap });
      continue;
    }
    if (typeof v === "object" && (v as any).enumValues && (v as any).enumName) {
      expectedEnums.set((v as any).enumName, (v as any).enumValues);
    }
  }

  console.log("=== TABLES ===");
  console.log(`Expected: ${expectedTables.size}, Live: ${liveTables.size}`);
  const missing = [...expectedTables.keys()].filter(t => !liveTables.has(t));
  const extra = [...liveTables].filter(t => !expectedTables.has(t));
  console.log("Missing in Supabase:", missing.length ? missing.join(", ") : "none");
  console.log("Extra in Supabase (not in schema):", extra.length ? extra.join(", ") : "none");

  console.log("\n=== COLUMN DIFFS ===");
  let driftCount = 0;
  for (const [tname, { cols: expCols }] of expectedTables) {
    if (!liveTables.has(tname)) continue;
    const live = liveCols.get(tname) || new Map();
    const missCols = [...expCols.keys()].filter(c => !live.has(c));
    const extraCols = [...live.keys()].filter(c => !expCols.has(c));
    if (missCols.length || extraCols.length) {
      driftCount++;
      console.log(`[${tname}]`);
      if (missCols.length) console.log("  MISSING IN SUPABASE:", missCols.join(", "));
      if (extraCols.length) console.log("  EXTRA IN SUPABASE:  ", extraCols.join(", "));
    }
  }
  if (driftCount === 0) console.log("(no column drift)");

  console.log("\n=== ENUMS ===");
  console.log(`Expected: ${expectedEnums.size}, Live: ${liveEnums.size}`);
  for (const [name, vals] of expectedEnums) {
    if (!liveEnums.has(name)) {
      console.log(`MISSING ENUM: ${name} (${vals.join("|")})`);
      continue;
    }
    const liveVals = liveEnums.get(name)!;
    const missVals = vals.filter(v => !liveVals.includes(v));
    const extraVals = liveVals.filter(v => !vals.includes(v as any));
    if (missVals.length || extraVals.length) {
      console.log(`ENUM ${name}: missing_in_live=${missVals.join("|")||"-"}  extra_in_live=${extraVals.join("|")||"-"}`);
    }
  }
  const extraEnums = [...liveEnums.keys()].filter(e => !expectedEnums.has(e));
  if (extraEnums.length) console.log("Extra enums in Supabase (not in schema):", extraEnums.join(", "));

  console.log("\n=== ROW COUNTS (live) ===");
  for (const t of [...liveTables].sort()) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
      console.log(`  ${t.padEnd(35)} ${r.rows[0].c}`);
    } catch (e: any) {
      console.log(`  ${t.padEnd(35)} ERR ${e.message}`);
    }
  }

  console.log(`\nTotal FKs in live: ${fkRes.rows.length}`);
  console.log(`Total indexes in live: ${idxRes.rows.length}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
