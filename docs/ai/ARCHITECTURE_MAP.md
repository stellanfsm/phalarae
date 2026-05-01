# Phalarae Architecture Map

## System overview

Phalarae is a multi-tenant intake system for personal injury law firms. It provides:

- Public intake chat (full page + embed)
- Deterministic + LLM-assisted intake interpretation
- Lead creation with routing tags and summaries
- Firm-scoped admin workspace for lead handling and firm setup

Core pipeline:
`IntakeClient` -> `/api/intake` -> `IntakeSession/IntakeMessage` -> completion -> `Lead` -> optional alert email -> admin review.

## Folder map

- `app/`
  - Route pages and API endpoints.
  - Public: `/intake/[slug]`, `/embed`
  - Admin: `/admin/*`, invite acceptance, login/logout APIs
  - Intake engine endpoint: `app/api/intake/route.ts`
- `components/`
  - `components/intake/*`: chat UI and embed launcher.
  - `components/admin/*`: admin shell, forms, lead controls, status UI.
- `lib/`
  - Domain centers: intake steps, parsing, qualification, summaries, auth context, branding resolution.
- `prisma/`
  - `schema.prisma`, migrations, and seed setup.
- `docs/`
  - Operational docs (`GO_LIVE.md`) and AI guidance (`docs/ai/*`).
- `middleware.ts`
  - Admin auth redirect gate and embed request header marking.

## Route map

- `/intake/[slug]`: full intake surface for one firm; only `Firm.status = active`.
- `/embed`: embed entry; supports sanitized overrides and inline/launcher modes.
- `/api/intake`: intake state machine (`start`, `acknowledge_disclaimer`, `resume`, `message`).
- `/admin/login` + `/api/admin/login`: admin auth and session creation.
- `/api/admin/logout`: current session revocation + cookie clear.
- `/admin/leads`: lead list, filters, analytics.
- `/admin/leads/[id]`: lead detail with workflow/assignment/notes.
- `/admin/firms`: firm index.
- `/admin/firms/[id]`: firm settings, readiness, status, embed snippets.
- `/admin/firms/[id]/users`: user list/invite/activation management.
- `/admin/invite/[token]`: invite acceptance and account setup.
- `/admin/account`: password change.

## Data model map

Main entities:

- `Firm`: tenant record, branding/disclaimer, notification email, status.
- `IntakeSession`: stateful in-progress intake + JSON data blob + completion marker.
- `IntakeMessage`: transcript timeline.
- `Lead`: one completed lead per intake session.
- `AdminUser`: role and firm scope.
- `AdminSession`: revocable auth session table.
- `AdminInvite`: invite token and expiration lifecycle.
- `LeadNote`: internal collaboration notes.

Notable relationships:

- `Lead.intakeSessionId` is unique (1:1 with session).
- `Lead` belongs to a `Firm`; optional assignee to `AdminUser`.
- `Firm` owns users, invites, sessions, and leads.

## Intake engine map

Entry and progression:

- Client (`components/intake/IntakeClient.tsx`) starts/resumes session via `/api/intake`.
- Disclaimer must be acknowledged before question flow.
- Steps defined in `lib/intake-steps.ts` with conditional branches:
  - `motorVehicleInvolvement` only for motor vehicle incidents.
  - `urgent` skipped when `hasAttorney = yes` (auto-defaulted).

Turn interpretation:

- Deterministic extraction always runs (`lib/intake-multi-extract.ts`).
- OpenAI enrichment/classification runs when API key exists (`lib/openai-intake.ts`).
- Clarification rounds tracked in intake meta (`lib/intake-session-meta.ts`).
- Force-accept path after max clarifications for eligible fields (`lib/intake-force-accept.ts`).

Completion:

- Final payload validated with `intakePayloadSchema`.
- Qualification via `lib/qualify.ts`.
- Summary generation via `lib/summary.ts`.
- Transaction commits session completion + lead creation + closing message.
- Alert email attempted afterward; `Lead.alertStatus`/`alertError` updated.

## Admin/workspace map

Auth/session model:

- Login verifies credentials, creates `AdminSession`, signs JWT with `sessionId`.
- `getAdminContext()` verifies token and session row validity.
- Middleware blocks unauthenticated `/admin` routes (with login/invite exceptions).

Roles:

- `operator`: cross-firm.
- `firm_admin`: firm-scoped admin.
- `firm_staff`: firm-scoped limited admin.

Primary admin flows:

- Lead triage: list/filter/detail, auto-transition `new -> open` on first detail view.
- Lead collaboration: assignment and notes.
- Firm setup: branding/disclaimer/email config, readiness checks, status activation.
- User ops: invites, activation/deactivation, last-admin protection.

## Embed/widget map

- `/embed` resolves firm and optional query overrides.
- `inline` mode renders full intake widget (`IntakeWidget`).
- default mode renders floating launcher/panel (`IntakeEmbedWidget`) around same intake client.
- Embed-specific transparency relies on:
  - `middleware.ts` setting `x-phalerae-embed`
  - `app/layout.tsx` applying embed class
  - `app/globals.css` forcing transparent backgrounds

## Duplication and drift risks

- Workflow status semantics are repeated across schema defaults, server actions, list filters, and UI controls.
- Auth checks are intentionally repeated (middleware + layouts + actions), but can drift if changed partially.
- `app/api/intake/route.ts` is a large orchestration file with mixed concerns.
- `docs` can drift from runtime code; verify file references exist before relying on docs.

## Safe extension patterns

- Reuse existing domain centers in `lib/*`; do not add parallel business rule files.
- For admin mutations: enforce auth + role + firm access before write; then `revalidatePath`.
- For intake changes: update steps + parser + summary + admin presentation together.
- For embed changes: preserve middleware/layout/CSS chain and sync admin snippet output.
- Prefer extending existing status/role maps to keep UI labels and behavior aligned.
