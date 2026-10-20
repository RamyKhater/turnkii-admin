/* Read-only data-integrity scan for the requests pipeline. Spots the class of
   bug that silently drops leads: duplicate/ colliding references and any leads
   sitting in the dead-letter. Safe to run against production (reads only).

   Run (prod):  set -a; . ~/path/to/.env; set +a; npx tsx scripts/data-integrity.ts
   or:          DATABASE_URL=postgres://... npx tsx scripts/data-integrity.ts
*/
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error("Set DATABASE_URL (or POSTGRES_URL) to the database to scan."); process.exit(2); }
const sql = neon(url);

let warn = 0, fail = 0;
const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const w = (m: string) => { warn++; console.log(`  \x1b[33m!\x1b[0m ${m}`); };
const bad = (m: string) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

async function main() {
  console.log("\nRequests — reference integrity");
  // 1. Actual duplicate refs (would mean a past collision slipped through).
  const dups = await sql`SELECT ref, count(*)::int c FROM requests GROUP BY ref HAVING count(*) > 1 ORDER BY ref`;
  if (dups.length) bad(`duplicate refs in use: ${dups.map((d) => `${d.ref}×${d.c}`).join(", ")}`);
  else ok("no duplicate references");

  // 2. Informational: would the retired count()+2400 scheme collide today?
  //    (Not a health signal — the code no longer uses it; this just records why.)
  const [{ c }] = await sql`SELECT count(*)::int c FROM requests`;
  const collides: string[] = [];
  for (const [, prefix] of [["brief", "TK"], ["financing", "TF"], ["service", "TS"], ["project", "TP"]] as const) {
    const guess = `${prefix}-${2400 + c}`;
    if ((await sql`SELECT 1 FROM requests WHERE ref = ${guess}`).length) collides.push(guess);
  }
  if (collides.length) console.log(`    (note: the retired count-based scheme would collide today on ${collides.join(", ")} — now handled by the allocator)`);

  // 3. The collision-proof allocator's next refs are free (sanity).
  const [{ maxn }] = await sql`SELECT coalesce(max(split_part(ref,'-',2)::int), 2399) maxn FROM requests`;
  const next = Math.max(2400, Number(maxn) + 1);
  const taken = await sql`SELECT 1 FROM requests WHERE ref = ${`TK-${next}`}`;
  if (taken.length) bad(`next allocated ref TK-${next} is already taken — allocator assumption broken`);
  else ok(`next reference TK-${next} is free (max suffix in use: ${maxn})`);

  console.log("\nDead-letter — captured leads awaiting recovery");
  const dl = await sql`SELECT to_regclass('public.failed_submissions') t`;
  if (!dl[0].t) {
    w("failed_submissions table not present (deploy the capture migration)");
  } else {
    const [{ p }] = await sql`SELECT count(*)::int p FROM failed_submissions WHERE status='pending'`;
    if (p > 0) {
      bad(`${p} lead(s) captured but NOT yet recovered — review /requests/recovery`);
      const rows = await sql`SELECT id, route, contact_name, phone, to_char(created_at,'YYYY-MM-DD HH24:MI') at FROM failed_submissions WHERE status='pending' ORDER BY created_at DESC LIMIT 20`;
      for (const r of rows) console.log(`      #${r.id} ${r.at} [${r.route}] ${r.contact_name ?? "—"} ${r.phone ?? ""}`);
    } else ok("no leads pending recovery");
  }

  console.log(`\n=== ${fail} failed, ${warn} warning(s) ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("scan error:", e); process.exit(2); });
