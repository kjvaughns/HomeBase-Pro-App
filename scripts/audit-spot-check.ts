import pg from "pg";
const { Client } = pg;

async function main() {
  const url = process.env.SUPABASE_DATABASE_URL!;
  const client = new Client({ connectionString: url, ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined });
  await client.connect();

  const queries: Array<[string, string]> = [
    ["users.latest", `SELECT id, email, is_provider, created_at FROM users ORDER BY created_at DESC LIMIT 1`],
    ["providers.latest", `SELECT id, business_name, is_public, is_active, created_at FROM providers ORDER BY created_at DESC LIMIT 1`],
    ["homes.latest", `SELECT id, label, city, state, created_at FROM homes ORDER BY created_at DESC LIMIT 1`],
    ["appointments.latest", `SELECT id, service_name, status, scheduled_date, created_at FROM appointments ORDER BY created_at DESC LIMIT 1`],
    ["jobs.latest", `SELECT id, title, status, scheduled_date, created_at FROM jobs ORDER BY created_at DESC LIMIT 1`],
    ["invoices.latest", `SELECT id, status, total_cents, created_at FROM invoices ORDER BY created_at DESC LIMIT 1`],
    ["invoice_line_items.latest", `SELECT id, name, amount_cents FROM invoice_line_items ORDER BY id DESC LIMIT 1`],
    ["reviews.latest", `SELECT id, rating, created_at FROM reviews ORDER BY created_at DESC LIMIT 1`],
    ["clients.latest", `SELECT id, first_name, last_name, created_at FROM clients ORDER BY created_at DESC LIMIT 1`],
    ["notifications.latest", `SELECT id, type, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 1`],
    ["notification_deliveries.latest", `SELECT id, channel, status, event_type, created_at FROM notification_deliveries ORDER BY created_at DESC LIMIT 1`],
    ["provider_plans.latest", `SELECT provider_id, plan_tier, is_subscribed, subscription_source FROM provider_plans ORDER BY updated_at DESC NULLS LAST LIMIT 1`],
    ["stripe_connect_accounts.latest", `SELECT provider_id, onboarding_status, charges_enabled, livemode FROM stripe_connect_accounts ORDER BY created_at DESC LIMIT 1`],
    ["push_tokens.latest", `SELECT id, platform, is_active, created_at FROM push_tokens ORDER BY created_at DESC LIMIT 1`],
    ["support_tickets.latest", `SELECT id, category, status, created_at FROM support_tickets ORDER BY created_at DESC LIMIT 1`],
    ["housefax_entries.latest", `SELECT id, service_name, completed_at FROM housefax_entries ORDER BY created_at DESC LIMIT 1`],
    ["provider_messages.latest", `SELECT id, channel, status, created_at FROM provider_messages ORDER BY created_at DESC LIMIT 1`],
    ["app_reviews.legacy", `SELECT column_name FROM information_schema.columns WHERE table_name='app_reviews'`],
    ["booking_requests.legacy", `SELECT column_name FROM information_schema.columns WHERE table_name='booking_requests'`],
  ];

  for (const [label, q] of queries) {
    try {
      const r = await client.query(q);
      console.log(`\n[${label}]`);
      console.log(JSON.stringify(r.rows, null, 0));
    } catch (e: any) {
      console.log(`\n[${label}] ERR: ${e.message}`);
    }
  }
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
