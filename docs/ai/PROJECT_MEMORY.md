# Phalarae Project Memory

## What Phalarae is

Phalarae is a multi-tenant legal intake product for personal injury firms. It captures client intake via guided chat, stores structured session/lead data, auto-tags lead relevance, and provides an admin workspace for review and follow-up.

## Major runtime surfaces

- Public full-page intake: `/intake/[slug]`
- Public embed surface: `/embed?slug=...` (floating launcher or inline)
- Admin workspace: `/admin/*`
- Intake API engine: `/api/intake`
- Admin auth APIs: `/api/admin/login`, `/api/admin/logout`

## Key routes

- `/intake/[slug]`: firm-scoped intake entry; rejects non-`active` firms.
- `/embed`: firm-scoped embed entry with sanitized URL overrides (`firm`, `color`, `label`/`cta`, `inline`).
- `/admin/leads`: list, workflow filters, analytics.
- `/admin/leads/[id]`: lead detail, assignment, notes, workflow transition.
- `/admin/firms`, `/admin/firms/[id]`, `/admin/firms/[id]/users`: firm setup + user/invite management.
- `/admin/invite/[token]`: invite acceptance flow.

## Key models (Prisma)

- `Firm`: tenant root (`slug`, `branding`, `disclaimerOverride`, `notificationEmail`, `status`).
- `IntakeSession`: in-progress state (`currentStep`, `data`, `completedAt`).
- `IntakeMessage`: chat transcript rows.
- `Lead`: completed intake artifact (`summaryJson`, `humanSummary`, `qualificationTag`, workflow fields, alert status).
- `AdminUser`: role + optional firm scope (`operator` has `firmId = null`).
- `AdminSession`: revocable auth sessions.
- `AdminInvite`: hashed invite token workflow.
- `LeadNote`: collaboration notes.

## Architecture centers (single-source files)

- Intake step order/branching: `lib/intake-steps.ts`
- Intake turn interpretation: `lib/openai-intake.ts`
- Field parsing/normalization: `lib/intake-parse-field.ts`, `lib/intake-normalize.ts`, `lib/intake-multi-extract.ts`
- Intake route orchestrator: `app/api/intake/route.ts`
- Qualification/routing tags: `lib/qualify.ts`
- Lead summary shaping/parsing: `lib/summary.ts`
- Branding/disclaimer resolution: `lib/firm-display.ts`, `lib/disclaimer.ts`
- Admin identity + tenant access: `lib/admin-context.ts`, `lib/admin-token.ts`
- Route protection and embed header plumbing: `middleware.ts`, `app/layout.tsx`, `app/globals.css`

## Biggest constraints

- Tenant boundary safety: firm-scoped users must not access other firms' resources.
- Intake flow invariants: `currentStep` values must align with `FLOW_SEQUENCE` + state machine assumptions.
- Completion integrity: lead creation and session completion must remain atomic.
- Embed transparency behavior depends on middleware + root layout + CSS working together.
- Workflow semantics are spread across schema defaults, admin UI filters, and server actions.

## Biggest risks

- Large, multi-responsibility intake handler (`app/api/intake/route.ts`) is easy to break indirectly.
- Status/role string drift across files (not DB enum-backed).
- JSON blob coupling in `IntakeSession.data` (`payload` + `__intakeMeta`).
- Docs can drift from repo reality (e.g. prior stale `config/firm.ts` references).

## External tooling context (Cursor)

- Canonical index: `docs/ai/EXTERNAL_TOOLING_REFERENCES.md`
- Tracks requested external repos and usage:
  - Fallow (`fallow-rs/fallow`)
  - Claude Skills (`mastepanoski/claude-skills`)
  - Optiaxiom (`optimizely-axiom/optiaxiom`)
- Intent: keep agent-accessible references for quality analysis, skill workflows, and design-system research in one maintainable place.

## Safe extension guidance

- Put business rules in `lib/*` first; keep routes/components orchestration-focused.
- Extend existing intake pattern (steps + parser + summary + admin display) rather than adding parallel logic paths.
- Keep firm gating (`status === active`) and tenant access checks explicit in server code.
- For admin mutations, keep server action pattern: auth/role/access checks -> Prisma mutation -> revalidation.

## Dependency notes (must-check chains)

- If we change `FLOW_SEQUENCE` in `lib/intake-steps.ts`, also check:
  - `app/api/intake/route.ts` step handling
  - `lib/openai-intake.ts` extraction assumptions
  - admin labels in `app/admin/leads/page.tsx`
  - lead detail rendering in `app/admin/leads/[id]/page.tsx`

- If we change qualification rules in `lib/qualify.ts`, also check:
  - summary generation/parsing in `lib/summary.ts`
  - lead list badges and analytics in `app/admin/leads/page.tsx`
  - lead detail status context in `app/admin/leads/[id]/page.tsx`

- If we change role names or access semantics, also check:
  - `lib/admin-context.ts`, `lib/admin-token.ts`
  - `middleware.ts`
  - all admin server actions under `app/admin/**/actions.ts`
  - `components/admin/AdminShell.tsx` navigation

- If we change firm branding or alert recipient logic, also check:
  - `lib/firm-display.ts`
  - `app/intake/[slug]/page.tsx` and `app/embed/page.tsx`
  - `/api/intake` opening/closing and alert send path
  - firm settings form/action in `components/admin/FirmSettingsForm.tsx` and `app/admin/firms/actions.ts`

- If we change embed behavior, also check:
  - `middleware.ts` embed header injection
  - `app/layout.tsx` header usage
  - `app/globals.css` embed transparency selectors
  - admin snippet generator in `app/admin/firms/[id]/page.tsx`
