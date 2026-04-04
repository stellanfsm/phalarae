# Go live: what the repo gives you vs what you set up

This doc splits **what is implemented in this codebase** (or doable in Cursor on the repo) from **what you must configure outside the repo** before selling the product.

---

## Done in the app (multi-tenant intake)

- **Firm row in the database** drives intake: `slug`, `name`, `notificationEmail`, `disclaimerOverride`, `branding` JSON.
- **`lib/firm-display.ts`** merges **`config/firm.ts`** (optional per-slug demo override) with **DB branding** so customers do not need a code change for logo, color, phones, greeting, disclaimer, display name.
- **Intake + embed** (`/intake/[slug]`, `/embed?slug=…`) use that merge for UI copy and styling.
- **API intake** uses the same resolution for opening messages, closing message, and **lead alert** recipient order: `config/firm.ts` `contactEmail` → `branding.contactEmail` → `Firm.notificationEmail` → `LEAD_ALERT_EMAIL` env.
- **Admin**
  - **`/admin/firms`** — list firms (scoped: users with `AdminUser.firmId` see only their firm).
  - **`/admin/firms/[id]`** — edit firm name, alert email, disclaimer override, branding fields (slug read-only in UI).
  - **`/admin/leads`** — filtered by `firmId` for firm-scoped operators; platform operators (`firmId` null) see all leads.

---

## You set up (hosting & operations)

### Infrastructure

- **Production host** for the Next.js app (e.g. Vercel, Railway, Fly, a VPS). Point your **primary domain** (e.g. `app.phalerae.com`) at it with **HTTPS**.
- **`DATABASE_URL`** in production (e.g. Supabase Postgres, Neon). Run migrations: `npx prisma migrate deploy` (or your CI step).
- **Secrets in the host env**, not in git:
  - `ADMIN_JWT_SECRET` (or equivalent per your auth setup)
  - `OPENAI_API_KEY` (or your LLM provider)
  - **`RESEND_API_KEY`** (or other mail) + **verified sending domain**
  - `LEAD_ALERT_EMAIL` — optional fallback when a firm has no alert address
  - Any rate-limit / analytics keys you add later

### Email

- **DNS** for your sending domain (SPF, DKIM, DMARC as your provider requires).
- **Inbox** that actually receives lead alerts (firm `notificationEmail` or env fallback).

### Customer sites (e.g. Hostinger)

- **No deploy of this repo** to the customer. They paste an **embed snippet** that points at **your** origin, e.g. `https://app.yourdomain.com/embed?slug=their-firm-slug`.
- They keep their own **privacy policy / terms** on their site if the embed is framed there.

### Business / legal (your responsibility)

- **Terms of service**, **privacy policy**, and **retention** for intake data and transcripts.
- **Attorney advertising / ethics** rules for your jurisdictions (disclaimers, “not legal advice”, etc.).
- **Billing** (Stripe, invoices, contracts) — not in this repo.
- **Support process** for changing **slugs** (admin UI keeps slug read-only; use DB or an internal tool if you must rename).

### Optional code workflow (you / Cursor)

- **`config/firm.ts`** — keep for **one** demo slug or a pilot with file-based overrides; production customers should rely on **admin + DB** so you do not ship config edits per firm.
- **Seed / new firms** — `prisma/seed.ts` or SQL: create `Firm` + `AdminUser` with matching `firmId` for firm-only logins.

---

## Quick embed example (for customer paste)

Replace origin and slug:

```html
<iframe
  src="https://YOUR_DOMAIN/embed?slug=FIRM_SLUG"
  title="Intake"
  width="100%"
  height="640"
  style="border:0;max-width:420px"
></iframe>
```

Admin stays on **your** URL (`/admin/...`), not on the customer’s host.
