// Usage: node delete-user.mjs <email-or-phone>
// Example: node delete-user.mjs test@example.com
// Example: node delete-user.mjs +919876543210

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yvsglotmanqmvcogbbkf.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c2dsb3RtYW5xbXZjb2diYmtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkwOTgwOCwiZXhwIjoyMDkxNDg1ODA4fQ.DNmJjP969a8TpL7ss_5f2KaT-8AdJg-ek2UsH0IKcEE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const identifier = process.argv[2];
if (!identifier) {
  console.error("❌  Please provide an email or phone number.");
  console.error("    Usage: node delete-user.mjs <email-or-phone>");
  process.exit(1);
}

// List all users and find by email or phone
const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error("❌  Failed to list users:", listErr.message); process.exit(1); }

// Print all users so you can see exact phone/email format
console.log("\n── All auth users in Supabase ──");
users.forEach(u => console.log(`  id: ${u.id} | email: ${u.email ?? "—"} | phone: ${u.phone ?? "—"}`));
console.log("─────────────────────────────────\n");

// Also show orphaned profiles (profile row exists but no auth user)
const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone");
const authIds = new Set(users.map(u => u.id));
const orphaned = (profiles ?? []).filter(p => !authIds.has(p.id));
if (orphaned.length > 0) {
  console.log("── Orphaned profile rows (no auth account) ──");
  orphaned.forEach(p => console.log(`  id: ${p.id} | name: ${p.full_name ?? "—"} | phone: ${p.phone ?? "—"}`));
  console.log("  (run with --clean-orphans to delete these)\n");
  if (process.argv.includes("--clean-orphans")) {
    for (const p of orphaned) {
      await supabase.from("profiles").delete().eq("id", p.id);
      console.log(`  ✅ Deleted orphaned profile: ${p.phone ?? p.id}`);
    }
  }
}

const user = users.find(u =>
  u.email === identifier ||
  u.phone === identifier ||
  u.phone === identifier.replace(/\s/g, "")
);

if (!user) {
  console.error(`❌  No user found with identifier: ${identifier}`);
  console.error("    Check the list above and retry with the exact phone/email shown.");
  process.exit(1);
}

console.log(`Found user: ${user.email ?? user.phone} (id: ${user.id})`);
console.log("Deleting...");

// Delete from auth (profiles row will cascade if FK is set)
const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
if (delErr) { console.error("❌  Delete failed:", delErr.message); process.exit(1); }

// Also clean up profiles row just in case there's no cascade
await supabase.from("profiles").delete().eq("id", user.id);

console.log(`✅  User deleted successfully.`);
