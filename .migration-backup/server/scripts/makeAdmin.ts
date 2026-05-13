import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

const EMAIL = 'kaeden@homebaseproapp.com';
const TEMP_PASSWORD = 'HomeBase2026!';

async function main() {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) { console.error('No SUPABASE_DATABASE_URL'); process.exit(1); }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  const db = drizzle(pool);

  // Check if account already exists
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL));
  if (existing.length > 0) {
    // Just promote to admin
    const result = await db.update(users).set({ isAdmin: true }).where(eq(users.email, EMAIL))
      .returning({ id: users.id, email: users.email, isAdmin: users.isAdmin });
    console.log('Existing account promoted to admin:', JSON.stringify(result[0]));
    await pool.end();
    return;
  }

  const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 10);

  const result = await db.insert(users).values({
    email: EMAIL,
    password: hashedPassword,
    firstName: 'Kaeden',
    isAdmin: true,
    isProvider: false,
    tokenVersion: 0,
  }).returning({ id: users.id, email: users.email, isAdmin: users.isAdmin });

  console.log('Admin account created:', JSON.stringify(result[0]));
  console.log(`Temporary password: ${TEMP_PASSWORD}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
