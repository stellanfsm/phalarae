# Phalerae (MVP)

Website-based **structured intake assistant** for personal injury law firms. It collects lead information step-by-step, applies **non-legal** routing tags, stores submissions in PostgreSQL, and exposes a small **operator dashboard**. It is **not** a substitute for an attorney and does not provide legal advice.

## Stack (and why)

- **Next.js (App Router) + TypeScript** — one codebase for UI, API routes, and server rendering; easy to deploy (Vercel, Railway, etc.).
- **Tailwind CSS** — fast, consistent styling without a heavy component library.
- **PostgreSQL + Prisma** — relational storage for firms, sessions, messages, and leads; migrations are versioned in `prisma/migrations`.
- **OpenAI** (optional but recommended) — bounded JSON-style behavior for refusals, light NLU, and tone; the flow is still **schema-driven** on the server.
- **Resend** (optional) — transactional email for new-lead alerts.

**Prisma note:** This repo pins **Prisma 6** so `PrismaClient` works with a normal `DATABASE_URL`. Prisma 7’s default client expects a driver adapter; upgrading later is straightforward when you want edge/accelerate.

## Prerequisites

- Node.js 20+ (LTS recommended)
- PostgreSQL 14+ running locally or hosted
- (Optional) OpenAI API key
- (Optional) Resend API key + verified sender

## Local setup (exact steps)

1. **Install dependencies**

   ```bash
   cd phalerae
   npm install
   ```

   *(If your folder is still named `phalarae` from an earlier setup, `cd` into that folder instead.)*

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   - `DATABASE_URL` — PostgreSQL connection string.
   - `ADMIN_JWT_SECRET` — long random string (16+ characters) for signing the admin session cookie.
   - `OPENAI_API_KEY` — recommended for best UX and refusal behavior.
   - `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — optional; if set, completed intakes email the firm (see below).
   - `LEAD_ALERT_EMAIL` — fallback inbox if `Firm.notificationEmail` is empty.

3. **Apply database schema**

   ```bash
   npx prisma migrate deploy
   ```

   For active development you can instead use:

   ```bash
   npx prisma migrate dev
   ```

4. **Seed demo firm + admin user**

   ```bash
   npm run db:seed
   ```

   Defaults:

   - Firm slug: **`demo`** (intake URL: `/intake/demo`)
   - Admin email: **`admin@phalerae.local`**
   - Password: **`changeme`** unless you set `SEED_ADMIN_PASSWORD` in `.env` before seeding.

5. **Run the app**

   ```bash
   npm run dev
   ```

   - Marketing / entry: [http://localhost:3000](http://localhost:3000)
   - Intake: [http://localhost:3000/intake/demo](http://localhost:3000/intake/demo)
   - Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## How to customize for a new law firm demo

One file drives branding, copy, alert email, and urgent phone for the **configured intake slug** (default `demo`):

1. Open **[`config/firm.ts`](config/firm.ts)** and edit:
   - `firmName`, `logoUrl` (optional URL), `primaryColor` (hex)
   - `contactEmail` — where **new lead emails** go when this slug is used (overrides the firm row’s notification email first)
   - `disclaimerText`, `greetingMessage`
   - `urgentPhoneDisplay` and `urgentPhoneTel` (digits/`+` for the `tel:` link)
   - `intakeSlug` — must match the URL (`/intake/{slug}`) **and** the `Firm.slug` in the database (see `prisma/seed.ts`; re-seed or update the row if you change the slug)
2. **Restart** the dev server or redeploy so Next.js picks up changes.
3. **Share the link:** `https://your-host/intake/demo` (or your slug).

**MVP limits:** Only the slug that matches `firmDemoConfig.intakeSlug` uses this file. Other `Firm` rows still use database branding only. Lead email still needs `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env`.

**Website widget:** Use the dedicated embed route **`/embed`** (floating launcher + chat panel inside the iframe). See [Embedding the widget on a client website](#embedding-the-widget-on-a-client-website) below. The full-page UI remains at `/intake/{slug}` ([`components/intake/IntakeWidget.tsx`](components/intake/IntakeWidget.tsx)).

### Prisma on Windows: `EPERM` / `rename … query_engine-windows.dll.node`

The client is generated into **`app/generated/prisma`** (see `prisma/schema.prisma` `output`) so `npm install` / `prisma generate` does not write under `node_modules/.prisma`, where Microsoft Defender and OneDrive often block the final rename. If you still see permission errors, add an exclusion for the project folder or move the repo out of a synced OneDrive path, then run `npx prisma generate`.

## Troubleshooting: “Invalid `prisma` invocation” / intake crashes / login always fails

Usually the app **cannot reach Postgres** (not a bad password only—often **network / IPv6**).

1. Open **Supabase → your project → Connect**.
2. Copy the **Session pooler** (or **Transaction pooler**) **URI**—it uses hosts like `aws-0-…pooler.supabase.com` and works on more networks than the raw `db.….supabase.co` URL.
3. Replace **`DATABASE_URL`** in `.env` with that URI (keep your password embedded as Supabase shows it).
4. Run:

   ```bash
   npm run setup:db
   ```

5. Restart dev: `npm run dev`

### “Tenant or user not found” or intake/admin login 503

Supabase is rejecting the **username or password** in `DATABASE_URL` (not an app bug).

1. **Supabase → Project Settings → Database** — if unsure, use **Reset database password** and copy the new password.
2. **Supabase → Connect** — copy the **full** connection string shown for **Session pooler** (it includes user `postgres.yourprojectref` and the correct host).
3. Replace the entire `DATABASE_URL=...` line in `.env` with that string (no manual edits to the password inside the URL unless you know URL-encoding for special characters).
4. Run `npm run setup:db` again, then restart `npm run dev`.

**Admin login** only works after `setup:db` has created **`admin@phalerae.local`** (password `changeme` unless you set `SEED_ADMIN_PASSWORD` before seeding).

Dev server uses **webpack** (`next dev --webpack`) so Prisma and bcrypt load correctly; Turbopack can confuse those libraries.

## How intake works (architecture)

1. **Start** — `POST /api/intake` with `{ "action": "start", "firmSlug": "demo" }` creates an `IntakeSession` (`currentStep: disclaimer`) and stores opening assistant messages.
2. **Disclaimer** — the visitor acknowledges via `{ "action": "acknowledge_disclaimer", "sessionId" }`; the server advances to the first structured field (incident flow order in `lib/intake-steps.ts`).
3. **One question at a time** — each `{ "action": "message", "sessionId", "text" }` is interpreted for the **current field only** (`lib/openai-intake.ts`). Legal-advice requests get a **refusal** without advancing the schema.
4. **Completion** — when all fields validate (`lib/schemas/intake-data.ts`), the server creates a `Lead`, runs **rules-only** qualification (`lib/qualify.ts`), stores JSON + human summary, and sends email if configured.

## Email alerts (Resend)

When a lead completes:

- Recipient = `Firm.notificationEmail` if set, else `LEAD_ALERT_EMAIL`.
- Sending is skipped if `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing (local dev is fine without it).

## Rate limiting

`lib/rate-limit.ts` applies a simple per-IP limit to `POST /api/intake` (default **30/min**, override with `INTAKE_RATE_LIMIT_PER_MIN`). Swap for Redis/Upstash when you run multiple instances.

## Multi-firm (future-ready)

- Each `Firm` has `slug`, `branding` JSON, optional `disclaimerOverride`, optional `intakeConfig` JSON (reserved for custom questions).
- Intake URL pattern: `/intake/[slug]`.
- MVP seeds one firm (`demo`). Add rows via Prisma Studio or SQL when onboarding new firms.

## Embedding the widget on a client website

Phalerae serves a **self-contained embed page** at **`/embed`**. It runs entirely inside the iframe document (Tailwind + your app styles only affect that document, not the parent law firm site). The widget shows a **floating button**; clicking it opens the same **IntakeClient** flow used elsewhere, talking to **`POST /api/intake`** on your domain (no extra SDK).

### Copy-paste snippet (iframe + fixed corner)

Replace `https://your-domain.com` with your production host (or `http://localhost:3000` while testing). Adjust `width` / `height` so the open panel fits; mobile browsers work best with a **taller** iframe (e.g. 85–92vh equivalent).

```html
<!-- Phalerae intake widget: fixed bottom-right on the law firm site -->
<div
  style="position:fixed;bottom:16px;right:16px;width:min(420px,calc(100vw - 32px));height:min(600px,calc(100vh - 32px));z-index:999999;border:none;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,0.18);overflow:hidden;background:transparent"
>
  <iframe
    src="https://your-domain.com/embed?slug=demo"
    title="Case intake"
    style="width:100%;height:100%;border:0;display:block"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
</div>
```

### URL query parameters (`/embed?…`)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `slug` | No (defaults to the slug in [`config/firm.ts`](config/firm.ts) `intakeSlug`, usually `demo`) | Must match a **`Firm.slug`** in the database — this selects which firm’s intake session + branding base. |
| `firm` | No | Display name override (URL-encoded), e.g. `firm=Sewell%20Law`. Does not change the database firm record. |
| `color` | No | Primary accent: **hex** (`#9E1D20`) or a **named** token: `blue`, `navy`, `red`, `burgundy`, `green`, `teal`, `purple`, `slate`, `black`. Unknown values fall back to firm config / DB branding. |
| `label` or `cta` | No | Floating button text (default **`Free case review`**). Max ~80 characters; HTML is stripped. |

Example:

`https://your-domain.com/embed?slug=demo&firm=Sewell%20Law&color=blue&label=Chat%20with%20us`

### Per-firm customization

- **Database + config file:** `slug` must exist on `Firm`. For the slug wired in `config/firm.ts`, logo, disclaimer, phones, and alert email come from that file (see [How to customize for a new law firm demo](#how-to-customize-for-a-new-law-firm-demo)).
- **One-off marketing overrides:** use `firm` + `color` + `label` in the iframe `src` for campaigns without redeploying.

### Test locally

1. Run `npm run dev`.
2. Open **`http://localhost:3000/embed?slug=demo`** — you should see the launcher; open it and complete a test intake.
3. To mimic a client site, save the HTML snippet above with `src="http://localhost:3000/embed?slug=demo"` and open the file in a browser (some browsers restrict `file://` iframes; a second local static server is fine).

### Deploy

Deploy the Next app as usual. The parent site only needs the iframe `src` pointing at **your** HTTPS origin so cookies and `fetch("/api/intake")` stay same-origin inside the iframe.

### Full-page alternative

For a dedicated landing page (no floating launcher), keep using **`/intake/[slug]`** instead of `/embed`.

## Admin auth (shortcut, documented)

- **JWT in an httpOnly cookie** signed with `ADMIN_JWT_SECRET`.
- **No** full user-management UI in v1 — admins are created via **seed** or direct DB.
- For production, plan **password rotation**, **2FA**, and **audit logs** before handling real PII at scale.

## Security & compliance notes (non-exhaustive)

- You are handling **PII**; use HTTPS in production, restrict database access, and align with your counsel on privacy / advertising rules.
- Keep disclaimers prominent; this MVP duplicates the notice in-chat and in a toggle panel.
- `OPENAI_API_KEY` must stay **server-side only** (already the case).

## Scripts

| Script            | Purpose                          |
| ----------------- | -------------------------------- |
| `npm run dev`     | Development server               |
| `npm run build`   | Production build                 |
| `npm run start`   | Run production build             |
| `npm run db:seed` | Seed demo firm + admin           |
| `npm run db:migrate` | `prisma migrate deploy`     |
| `npm run db:push` | `prisma db push` (prototyping)   |

## What’s intentionally not in v1

- No native mobile app; web-only.
- No full RBAC / per-firm admin tenancy UI.
- No SLA-grade queueing for email; Resend send is best-effort inline.
- No HIPAA/medical-records workflow (PII yes; medical records are a higher bar).
- Next.js may deprecate `middleware.ts` in favor of “proxy” — watch Next 16+ release notes when upgrading.

---

**Disclaimer:** Phalerae is sample software. It does not provide legal advice. Consult qualified counsel for compliance with advertising, ethics, and privacy rules in your jurisdiction.
