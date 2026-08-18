# Turnkii Admin

Internal admin panel for Turnkii — manage the request pipeline, track performance,
and update the public site's content, with **server-enforced role-based access**.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) + **React 19**
- **Postgres via Drizzle ORM** — embedded **PGlite** for local dev (zero infra),
  **Neon** (or any Postgres) in production via the same schema
- **Custom session auth** — scrypt-hashed passwords, httpOnly cookie sessions
- **RBAC** — capabilities enforced in server actions, route handlers, and page guards
- **Tailwind v4**, brand-matched to Turnkii (cream / ink / lime, Manrope + Instrument Serif)

## Roles & access

Roles map to capabilities in [`lib/auth/rbac.ts`](lib/auth/rbac.ts). Enforcement is
server-side (`requireCap` / `assertCap`); the sidebar only *reflects* access.

| Role | Requests | Assign | Analytics | Content | Users |
|------|----------|--------|-----------|---------|-------|
| **Admin** | all | ✓ | ✓ | ✓ | ✓ |
| **Product manager** | all (read) | – | ✓ | ✓ | – |
| **Operations manager** | all | ✓ | ✓ | – | – |
| **Sales / field agent** | assigned only | – | own only | – | – |
| **Content editor** | – | – | – | ✓ | – |

## Getting started

```bash
npm install
npm run db:generate   # generate SQL migration from the Drizzle schema
npm run db:seed       # migrate + seed PGlite with demo data (creates ./.pglite)
npm run dev           # http://localhost:3000
```

**Demo accounts** (password `turnkii1234` for all):

| Role | Email |
|------|-------|
| Admin | `admin@turnkii.test` |
| Product manager | `pm@turnkii.test` |
| Operations manager | `ops@turnkii.test` |
| Sales / field agent | `sara@turnkii.test`, `omar@turnkii.test` |
| Content editor | `content@turnkii.test` |

`npm run db:reset` wipes and re-seeds. Stop `next dev` before seeding — PGlite is
single-process.

## What's inside

- **Dashboard** — KPIs, **SLA row** (first-response compliance, avg resolution,
  needs-attention), pipeline funnel, 8-week intake trend, demand by style **and service**,
  team load. Scoped to assigned requests for agents.
- **Requests** — filterable list (status / owner / source / search), **manual creation +
  assignment** (`/requests/new`), detail view with status transitions, assignment,
  priority, **SLA badges** (first-response + resolution), and a call/survey/note timeline.
  Agents only see and act on their own; every change hits the activity log.
- **Properties** — units under management with owner details, status, and portfolio
  insights.
- **Content** — editors for **services**, design styles, marketplace products, inspiration
  shots, and landing-page copy, each with publish/draft toggles, **image upload**, and
  delete. Marketplace shows insights (published / in-stock / categories).
- **Team** — create users, set roles, activate/deactivate (admin only; can't lock
  yourself out).
- **Settings** — feature flags to **hide/disable any website vertical**, and SLA targets
  that drive alerts (admin only).
- **Notifications** — in-app inbox + top-bar bell; fired on new / assigned requests and
  website intake.
- **Payments** — projects with contract values and payment schedules (down payments /
  milestones / installments), bank-transfer **receipts**, staff **record → verify** flow,
  and finance insights (collected / outstanding / overdue / pending) at project, property
  and portfolio level. Roles `payments:view` (admin/pm/ops) and `payments:manage`
  (admin/ops).
- **Owner portal** (`/portal`) — separate customer login (own `owners` table + `tk_owner`
  session cookie, fully isolated from staff). Owners see only their properties, projects
  and payments, and **pay by uploading a bank-transfer receipt** → the payment goes to
  "pending" and appears in the staff verification queue with a notification. Demo owner:
  `ramy@example.com` / `owner1234`.
- **APIs** — `POST /api/requests/intake` (create a website request), `GET /api/site-config`
  (verticals + SLA the public site reads), `POST /api/upload` (image/receipt upload,
  staff- or owner-authed).

### Wiring the public site's brief form

Point the Turnkii site's brief submit at the intake endpoint:

```js
await fetch("https://<admin-host>/api/requests/intake", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contactName, phone, email, propertyType, area, units,
    location, services, style, budgetPlan, message,
  }),
});
```

## Production (Neon)

Set `DATABASE_URL` (the app auto-switches from PGlite to Neon), then:

```bash
npm run db:migrate    # apply migrations to Postgres
DATABASE_URL=... npm run db:seed   # optional: seed
npm run build && npm start
```

## Deploy to Vercel (production)

The app auto-detects production: set `DATABASE_URL` and it uses Neon instead of
PGlite; set `BLOB_READ_WRITE_TOKEN` and uploads go to Vercel Blob instead of the
local filesystem. Migrations run automatically on deploy.

**1. Database (Neon).** Create a Neon Postgres DB, copy its pooled connection
string (`…?sslmode=require`).

**2. Storage (Vercel Blob).** In the Vercel project → Storage → create a Blob
store. It injects `BLOB_READ_WRITE_TOKEN`.

**3. Rate limiting (optional but recommended).** Create an Upstash Redis DB and
set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Without them a
per-instance in-memory limiter is used.

**4. Set env vars** in Vercel (Production): `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`,
and the two Upstash vars. Deploy — the build command (`vercel.json`) runs
`node scripts/migrate.mjs && next build`, applying migrations.

**5. Create the first admin** (one-time, from your machine pointed at Neon):

```bash
DATABASE_URL='postgres://…?sslmode=require' \
ADMIN_EMAIL='you@company.com' ADMIN_PASSWORD='a-strong-password' ADMIN_NAME='Your Name' \
npm run db:bootstrap
```

Sign in, then add the rest of the team from **Settings → Team**. (The demo
`db:seed` refuses to run against a real `DATABASE_URL`.)

**6. Deploy the public site** (`~/turnkii`, a separate static project) and point
its brief form at this admin:

```bash
SITE_ORIGIN=https://turnkii.com \
TURNKII_INTAKE_URL=https://admin.turnkii.com/api/requests/intake \
python3 build.py            # then deploy ~/turnkii/dist (vercel.json included)
```

Submitting the brief then creates a request here and notifies ops — verified
end-to-end (site → `POST /api/requests/intake` → Requests).

**7. Lock down CORS.** `/api/upload` and `/api/site-config` currently send
`Access-Control-Allow-Origin: *`; restrict them to your own origin. Keep
`/api/requests/intake` open (it's the public form endpoint) — it's rate-limited.

## Security notes

This is a working RBAC system, not a hardened deployment. Before production: rotate the
demo accounts, add rate limiting / CAPTCHA on the intake endpoint, restrict its CORS
origin (currently `*`), serve over HTTPS, and consider CSRF hardening on mutations.
