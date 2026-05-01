# Foundation Hardening Audit Matrix

## 1) Purpose

This matrix controls the **Foundation Hardening Sprint**. It is used to:

- prevent random cleanup edits and hidden feature work,
- anchor all stabilization work to repo source-of-truth files,
- enforce dependency-aware audits before implementation changes.

Use this file as the active checklist during the phase.

---

## 2) Core systems

## Intake engine

- **Covers**
  - Intake session lifecycle and state transitions (`start`, `acknowledge_disclaimer`, `resume`, `message`)
  - Step progression, parsing/normalization, completion, lead creation, summary/tag outputs
- **Source-of-truth files**
  - `app/api/intake/route.ts`
  - `lib/intake-steps.ts`
  - `lib/openai-intake.ts`
  - `lib/intake-parse-field.ts`
  - `lib/intake-normalize.ts`
  - `lib/intake-multi-extract.ts`
  - `lib/intake-session-meta.ts`
  - `lib/intake-force-accept.ts`
  - `lib/qualify.ts`
  - `lib/summary.ts`
  - `lib/schemas/intake-data.ts`
- **Key invariants**
  - Disclaimer acknowledgment required before question flow.
  - `currentStep` remains in valid domain (`disclaimer` | flow key | `complete`).
  - Completion is atomic: session finalization + lead creation + closing message.
  - Completion payload passes schema requirements (including contact fields).
  - `Lead.intakeSessionId` remains 1:1 unique.
- **Likely drift / bug vectors**
  - Large branch surface in `app/api/intake/route.ts`.
  - Step-key/string drift across flow, parsing, labels, and admin views.
  - Legacy compatibility path behavior (`preferredContact`) diverging from current flow.
- **Adjacent systems to check when changed**
  - Admin lead list/detail (`app/admin/leads/page.tsx`, `app/admin/leads/[id]/page.tsx`)
  - Email alert status flow (`lib/email.ts`, lead alert fields)
  - Embed/full intake client behavior parity (`components/intake/IntakeClient.tsx`)
- **Audit checks to perform**
  - Map every flow step to parser + prompt + summary/admin rendering path.
  - Trace each API action path for invariant preservation and consistent response shape.
  - Validate completion error-handling paths do not leave inconsistent artifacts.
  - Confirm forced-accept behavior aligns with schema and review flags.
- **Status**
  - `audited / issues found`
- **Notes**
  - Highest-risk system; audit before implementation refactors.
  - Audit findings:
    - `app/api/intake/route.ts` is a high-complexity orchestrator with mixed concerns (action routing, parsing, state transitions, legacy compatibility, completion transaction, email side effects).
    - Completion + alert-status logic is duplicated between the legacy `preferredContact` branch and the main `nextStep === "complete"` branch, increasing divergence risk.
    - Session-meta shape includes fields that are not used in the route path (`promptVariantByField`, `incidentTypeRaw`), which increases cognitive load and future drift risk.
  - Hardening decision in this pass:
    - Applied narrowly scoped helper extraction in intake route to centralize shared completion transaction + alert-status persistence used by both current and legacy completion paths.
    - Scope held to duplication removal only; no step, parsing, qualification, summary, or response-shape redesign.

## Admin workflow

- **Covers**
  - Lead triage lifecycle, filters, status changes, assignment, notes, analytics summary behavior
- **Source-of-truth files**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `app/admin/leads/[id]/actions.ts`
  - `components/admin/LeadWorkflowControl.tsx`
  - `components/admin/LeadAssignControl.tsx`
  - `components/admin/LeadNoteInput.tsx`
  - `components/admin/StatusBadge.tsx`
  - `lib/summary.ts`
- **Key invariants**
  - Workflow statuses are consistent across schema, actions, filters, and badges.
  - First detail-page view transitions `new` to `open` exactly once semantics.
  - Assignment is limited to active same-firm non-operator users.
  - Notes remain scoped to lead + author.
- **Likely drift / bug vectors**
  - Stringly-typed workflow/tag values duplicated across files.
  - UI and server action status domains drifting apart.
  - Analytics interpretations diverging from actual workflow/tag semantics.
- **Adjacent systems to check when changed**
  - Prisma model defaults/migration history for `Lead.workflowStatus`
  - Intake completion outputs (`qualificationTag`, summaries)
  - Role/permission checks in admin context/actions
- **Audit checks to perform**
  - Build a single workflow value map from all admin files and compare.
  - Verify list filters, detail status controls, and badge labels align.
  - Validate assignment and notes permission/path constraints.
- **Status**
  - `audited / issues found`
- **Notes**
  - Treat workflow value drift as a release-blocking stability issue.
  - Audit findings:
    - Workflow status domain was duplicated across list page, detail page, actions, and control component.
    - Lead detail used a direct cast from DB string to workflow union; unexpected DB values could break control rendering semantics.
  - Hardening applied in this phase:
    - Added canonical workflow helper (`lib/lead-workflow.ts`) and wired list/actions/control/badge to shared status domain.
    - Added defensive normalization in lead detail rendering (`normalizeLeadWorkflowStatus`) to keep UI stable if unexpected status values exist.

## Embed/widget runtime

- **Covers**
  - `/embed` entry behavior, launcher/inline modes, shared intake client runtime, iframe styling constraints
- **Source-of-truth files**
  - `app/embed/page.tsx`
  - `app/embed/layout.tsx`
  - `components/intake/IntakeEmbedWidget.tsx`
  - `components/intake/IntakeWidget.tsx`
  - `components/intake/IntakeClient.tsx`
  - `lib/embed-params.ts`
  - `middleware.ts`
  - `app/layout.tsx`
  - `app/globals.css`
  - `app/admin/firms/[id]/page.tsx` (embed snippet generation)
- **Key invariants**
  - Embed and full-page intake use the same intake engine behavior.
  - Embed transparency chain remains intact (middleware header -> layout class -> CSS).
  - Query overrides are sanitized and bounded.
  - Inline vs launcher mode selection remains deterministic.
- **Likely drift / bug vectors**
  - CSS/layout tweaks breaking iframe appearance.
  - Param handling drift between docs/snippets/runtime.
  - Behavioral divergence between embed and page variants.
- **Adjacent systems to check when changed**
  - Intake API behavior and intake client state machine.
  - Firm branding/display resolution.
  - Admin firm settings and snippet output.
- **Audit checks to perform**
  - Compare behavior matrix: full page vs embed launcher vs embed inline.
  - Verify embed URL params accepted/sanitized exactly as intended.
  - Validate snippet examples map to actual runtime params and modes.
- **Status**
  - `audited / no issue`
- **Notes**
  - High product-polish sensitivity; regressions are externally visible.
  - Audit findings:
    - Embed route and full-page intake both resolve firm data through `resolveFirmDisplay` and both render through shared `IntakeClient`, preserving core intake/runtime parity.
    - Mode split is intentional: `/embed` inline mode renders `IntakeWidget` (full chat shell), default mode renders `IntakeEmbedWidget` (launcher + panel shell) while both use the same API/session logic.
    - Shell transparency chain is coherent and dependency-coupled: `middleware.ts` sets `x-phalerae-embed` -> `app/layout.tsx` applies `phalerae-embed` class -> `app/globals.css` forces transparent embed background.
  - Hardening decision in this pass:
    - No runtime code change applied; observed risks are primarily integration/surface-level (host iframe sizing, CSS overrides, param usage expectations) and are best managed through verification discipline rather than behavior changes.

## Auth/session + tenant boundaries

- **Covers**
  - Admin login/logout/session validation, route gating, role scoping, firm resource access checks
- **Source-of-truth files**
  - `middleware.ts`
  - `lib/admin-token.ts`
  - `lib/admin-context.ts`
  - `app/api/admin/login/route.ts`
  - `app/api/admin/logout/route.ts`
  - `app/admin/**/layout.tsx`
  - `app/admin/**/actions.ts`
  - `app/admin/invite/[token]/actions.ts`
- **Key invariants**
  - Unauthorized admin requests are redirected/blocked.
  - Session revocation and expiry are enforced server-side.
  - Firm-scoped users cannot access other firms' resources.
  - Role restrictions (operator / firm_admin / firm_staff) are consistently enforced.
- **Likely drift / bug vectors**
  - Repeated policy checks diverging across actions/pages.
  - Middleware exceptions diverging from layout/action assumptions.
  - Invite/login/account flows producing unexpected session edge cases.
- **Adjacent systems to check when changed**
  - Admin navigation/surface visibility (`components/admin/AdminShell.tsx`)
  - Firm/user management flows (`/admin/firms/[id]/users`)
  - Lead and firm mutation actions
- **Audit checks to perform**
  - Build role-access matrix by route and action.
  - Verify `requireFirmAccess` usage for firm-owned resources.
  - Validate logout/password-change session revocation behavior.
- **Status**
  - `audited / issues found`
- **Notes**
  - Treat any cross-tenant risk as critical severity.
  - Audit findings:
    - Policy enforcement is duplicated across middleware, layouts, pages, and server actions (high drift risk).
    - Middleware only checks JWT validity (`verifyAdminToken`) and does not validate `AdminSession` revocation/expiry row; effective enforcement happens later via `getAdminContext()` in layouts/actions.
    - Resolved in this phase: `firm_staff` now receives route-level deny on `/admin/firms` tree via `app/admin/firms/layout.tsx`, aligning direct-route behavior with nav policy.

## Docs/process alignment

- **Covers**
  - AI operating docs and operational docs alignment with current codebase reality
- **Source-of-truth files**
  - `docs/ai/PROJECT_MEMORY.md`
  - `docs/ai/ARCHITECTURE_MAP.md`
  - `docs/ai/CHANGE_SAFETY_CHECKLIST.md`
  - `docs/ai/OPEN_QUESTIONS.md`
  - `docs/GO_LIVE.md`
- **Key invariants**
  - Referenced files and flows must exist in repo.
  - Stated routing/config behavior must match code.
  - Phase docs must constrain scope (no feature sprawl).
- **Likely drift / bug vectors**
  - Docs lagging architecture changes.
  - Setup/go-live claims retaining stale assumptions.
- **Adjacent systems to check when changed**
  - Any touched runtime system in this matrix.
  - Implementation PR templates/checklists if used.
- **Audit checks to perform**
  - Verify every named file/path in docs exists and reflects behavior.
  - Update only minimal facts needed for alignment during stabilization.
  - Confirm this matrix remains synchronized with actual phase scope.
- **Status**
  - `not audited`
- **Notes**
  - Recently had drift (`config/firm.ts`) corrected; keep vigilance.

## UI consistency shell

- **Covers**
  - Admin shell/nav/header consistency and role-conditioned UX structure across admin surfaces
- **Source-of-truth files**
  - `components/admin/AdminShell.tsx`
  - `components/admin/AdminNav.tsx`
  - `components/admin/PageHeader.tsx`
  - `components/admin/SignOutButton.tsx`
  - `components/admin/StatusBadge.tsx`
  - `app/admin/leads/layout.tsx`
  - `app/admin/firms/layout.tsx`
  - `app/admin/account/layout.tsx`
  - Admin page files under `app/admin/*/page.tsx`
- **Key invariants**
  - Role-based navigation is consistent with authorization boundaries.
  - Shared shell patterns are applied consistently across main admin surfaces.
  - Status/badge semantics are visually and textually consistent.
- **Likely drift / bug vectors**
  - Mixed legacy/new admin layout components.
  - Inconsistent page header/action patterns and tone.
  - Status label styling drift from workflow semantics.
- **Adjacent systems to check when changed**
  - Auth/session role gating.
  - Admin workflow status semantics.
  - Firm and lead pages using shared components.
- **Audit checks to perform**
  - Screen-by-screen consistency check across leads/firms/account/users/invite flows.
  - Confirm nav visibility by role aligns with actual permissions.
  - Confirm status badges represent canonical backend states.
- **Status**
  - `audited / issues found`
- **Notes**
  - UI shell alignment should follow auth/workflow audits, not precede them.
  - Audit findings:
    - Shared shell is mostly centralized via `AdminShell` + `AdminNav` + `PageHeader`, but mobile nav active-state cues were not aligned with desktop nav behavior.
    - A legacy, unused `components/admin/AdminHeader.tsx` existed with a parallel top-nav pattern and hardcoded links, creating a drift vector from role-aware shell behavior.
  - Hardening applied in this phase:
    - Added shared role-aware mobile nav component with active-path highlighting and wired it into `AdminShell`.
    - Removed unused legacy `AdminHeader` to reduce parallel shell patterns.

---

## 3) Cross-system invariants

- Intake completion must always produce a valid `Lead` artifact linked to a completed `IntakeSession`.
- Tenant boundaries must hold across page routes, server actions, and direct resource access (`requireFirmAccess` paths).
- Workflow status semantics must match across Prisma defaults, server actions, list filters, and badge rendering.
- Embed and full-page intake must share core intake behavior (no branch-specific business logic drift).
- Firm activation gating must be respected by public intake surfaces (`/intake/[slug]`, `/embed`).
- Branding/disclaimer resolution must remain DB-driven via `lib/firm-display.ts` and not split into parallel config systems.
- Admin session validity must require both JWT claim validity and `AdminSession` row validity.
- Documentation statements used during this phase must map to existing files and current runtime behavior.

---

## 4) Manual verification matrix

- [ ] Full-page intake happy path (active firm) to completed lead.
- [ ] Intake clarification path and force-accept review-flag path.
- [ ] Intake resume path within window and expired resume fallback.
- [ ] Embed launcher mode intake completion.
- [ ] Embed inline mode intake completion.
- [ ] Embed transparency and layout behavior in iframe host context.
- [ ] Admin login/logout session behavior.
- [ ] Lead list filter behavior (`new/open/contacted/archived`) + badge consistency.
- [ ] Lead detail auto-transition `new -> open`, assignment update, note creation.
- [ ] Firm settings update reflects in intake/embed branding/disclaimer.
- [ ] Firm status (`pending/active/inactive`) correctly gates public intake availability.
- [ ] Invite send -> accept -> first login flow.
- [ ] Role-based access checks (operator vs firm_admin vs firm_staff) on key admin surfaces.

---

## 5) Recommended audit order

1. Auth/session + tenant boundaries
2. Intake engine
3. Admin workflow
4. Embed/widget runtime
5. UI consistency shell
6. Docs/process alignment (final pass after above audits)

Rationale: enforce safety boundaries first, then core data flow, then dependent surfaces.

---

## 6) Change logging section

Use one entry per issue found during audit or implementation.

### Log entry template

- **Issue found**
  - (Short description)
- **System**
  - (`intake` | `admin-workflow` | `embed` | `auth-tenant` | `docs-process` | `ui-shell`)
- **Affected files**
  - `path/one`
  - `path/two`
- **Risk level**
  - (`low` | `medium` | `high` | `critical`)
- **Risk type**
  - (`bug risk` | `architecture risk` | `product confusion` | `polish debt` | `security/tenant risk`)
- **Fix approach**
  - (How to fix while staying in Foundation Hardening scope)
- **Adjacent verification needed**
  - (Which other systems/files must be rechecked)
- **Validation evidence**
  - (Manual checks run, test results, notes)
- **Status**
  - (`open` | `in progress` | `resolved` | `deferred`)

### Log entry

- **Issue found**
  - Auth policy is enforced in many layers with mixed strictness; direct-route access for `firm_staff` to firm settings pages is possible despite hidden nav links.
- **System**
  - `auth-tenant`
- **Affected files**
  - `middleware.ts`
  - `lib/admin-context.ts`
  - `app/admin/firms/page.tsx`
  - `app/admin/firms/[id]/page.tsx`
  - `components/admin/AdminShell.tsx`
- **Risk level**
  - `medium`
- **Risk type**
  - `architecture risk`
- **Fix approach**
  - Decide and codify explicit read-access policy for firm pages by role; then enforce at route/page level consistently (not only in nav).
- **Adjacent verification needed**
  - `app/admin/firms/[id]/users/page.tsx` role rules
  - `app/admin/firms/actions.ts` mutation guard rules
  - role matrix docs and manual auth verification paths
- **Validation evidence**
  - Static code audit across middleware, auth context, all admin layouts, all `app/admin/**/actions.ts`, and firm/lead/admin pages.
- **Status**
  - `resolved`

### Log entry

- **Issue found**
  - Admin shell had mobile/desktop nav coherence gap and an unused parallel header component that could reintroduce non-canonical shell behavior.
- **System**
  - `ui-shell`
- **Affected files**
  - `components/admin/AdminShell.tsx`
  - `components/admin/AdminMobileNav.tsx`
  - `components/admin/AdminHeader.tsx`
- **Risk level**
  - `low`
- **Risk type**
  - `architecture risk`
- **Fix approach**
  - Centralize mobile nav interaction cues using a shared role-aware client nav component and remove unused legacy header implementation.
- **Adjacent verification needed**
  - Mobile admin nav behavior on leads/firms/account routes by role
  - Desktop nav unaffected behavior
  - Sign-out and account links in mobile header
- **Validation evidence**
  - Static code audit across shell/layout/page surfaces + lint pass on changed files.
- **Status**
  - `resolved`

### Log entry

- **Issue found**
  - Embed/widget parity and shell integrity audit completed; no code-level defect requiring safe in-scope runtime change was found.
- **System**
  - `embed`
- **Affected files**
  - `app/embed/page.tsx`
  - `app/embed/layout.tsx`
  - `components/intake/IntakeEmbedWidget.tsx`
  - `components/intake/IntakeWidget.tsx`
  - `components/intake/IntakeClient.tsx`
  - `lib/embed-params.ts`
  - `lib/firm-display.ts`
  - `app/layout.tsx`
  - `app/globals.css`
  - `middleware.ts`
- **Risk level**
  - `low`
- **Risk type**
  - `architecture risk`
- **Fix approach**
  - No code fix required in this pass; retain shared intake runtime and enforce parity via manual verification matrix and existing cross-system invariants.
- **Adjacent verification needed**
  - `/intake/[slug]` vs `/embed?inline=1` parity for disclaimer/progression/completion behavior
  - `/embed` launcher mode open/close and chat lifecycle behavior
  - iframe transparency chain (middleware header + root layout + CSS)
- **Validation evidence**
  - Static audit across embed route/layout/components + firm display resolver + root layout/CSS/middleware dependency chain.
- **Status**
  - `resolved`

### Log entry

- **Issue found**
  - Intake orchestrator has mixed responsibilities and duplicated completion/alert logic across legacy and current completion paths.
- **System**
  - `intake`
- **Affected files**
  - `app/api/intake/route.ts`
  - `lib/intake-steps.ts`
  - `lib/intake-session-meta.ts`
  - `lib/summary.ts`
  - `lib/qualify.ts`
  - `lib/schemas/intake-data.ts`
- **Risk level**
  - `high`
- **Risk type**
  - `architecture risk`
- **Fix approach**
  - Implemented: extracted shared completion transaction and alert-status persistence into internal intake-route helpers used by both legacy and current completion paths, preserving behavior.
- **Adjacent verification needed**
  - Intake action paths: `start`, `acknowledge_disclaimer`, `resume`, `message`
  - Legacy `preferredContact` completion path
  - Lead list/detail rendering paths consuming summary/tag/alert fields
  - Email alert status visibility in admin surfaces
- **Validation evidence**
  - Static audit across intake route and intake dependencies + linter pass after helper extraction (no lint errors).
- **Status**
  - `resolved`

### Log entry

- **Issue found**
  - Lead workflow status domain duplicated across multiple surfaces, plus unsafe detail-page cast from DB string to workflow union.
- **System**
  - `admin-workflow`
- **Affected files**
  - `lib/lead-workflow.ts`
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `app/admin/leads/[id]/actions.ts`
  - `components/admin/LeadWorkflowControl.tsx`
  - `components/admin/StatusBadge.tsx`
- **Risk level**
  - `medium`
- **Risk type**
  - `architecture risk`
- **Fix approach**
  - Canonicalize workflow status values in one helper and consume it across list/detail/actions/control/badge.
  - Normalize unknown DB values in detail rendering to `"open"` for stability.
- **Adjacent verification needed**
  - Lead list filters and new-lead chip behavior
  - Detail auto-transition (`new` -> `open`)
  - Status badge rendering and workflow button actions
  - Analytics queries/counts tied to workflow states
- **Validation evidence**
  - Static audit + lint pass on updated files; no lint errors.
- **Status**
  - `resolved`

