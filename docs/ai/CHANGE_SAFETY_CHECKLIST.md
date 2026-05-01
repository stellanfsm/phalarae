# Change Safety Checklist (Phalarae)

Use this for any non-trivial change. Keep it filled from actual touched files, not guesses.

## 1) Scope the change

- What user-visible behavior changes?
- Which runtime surface is touched: `intake`, `embed`, `admin`, `auth`, `email`, or `data model`?
- Is this additive, behavioral, or migration-level?

## 2) Identify single-source files first

- Intake steps/branching: `lib/intake-steps.ts`
- Intake orchestration: `app/api/intake/route.ts`
- Parsing/normalization: `lib/intake-parse-field.ts`, `lib/intake-normalize.ts`
- Qualification: `lib/qualify.ts`
- Summary format: `lib/summary.ts`
- Auth/access: `lib/admin-context.ts`, `lib/admin-token.ts`, `middleware.ts`
- Branding/display: `lib/firm-display.ts`

If your change bypasses these sources, stop and justify why.

## 3) Adjacent flows likely affected

- Intake change -> check `/api/intake`, admin lead list/detail, and completion email payload.
- Admin workflow change -> check list filters, detail controls, and badge rendering.
- Role/access change -> check middleware, layouts, server actions, and nav visibility.
- Branding/embed change -> check `/intake/[slug]`, `/embed`, and admin embed snippets.
- Schema change -> check seed data, queries, UI assumptions, and migration backfill behavior.

## 4) Invariants that must remain true

- Firm-scoped users cannot access other firms' data.
- Intake cannot proceed before disclaimer acknowledgment.
- `currentStep` remains valid (`disclaimer` | flow key | `complete`).
- Completion writes session finalization + lead creation atomically.
- `Lead.intakeSessionId` remains one-to-one unique.
- `email` and `phone` remain valid at completion (no silent invalid lead contacts).

## 5) Tenant/auth/security implications

- Are all read/write endpoints and server actions enforcing `getAdminContext()`?
- Is `requireFirmAccess()` still applied to firm-owned resources?
- Did JWT/session behavior change? If yes, verify login/logout/invite/account flows.
- Any new URL params or user text rendered? Ensure sanitization/escaping path is explicit.

## 6) Intake/embed/admin implications

- Intake:
  - Start/ack/resume/message actions still coherent?
  - Progress labels/hints still correct?
- Embed:
  - Transparent iframe behavior still works (`middleware` + root layout + CSS)?
  - Inline vs launcher mode unchanged unless intentionally modified?
- Admin:
  - Lead list filters, counts, and detail transitions still aligned?
  - Assignment and notes still scoped to same firm?

## 7) Required manual test paths

- Public intake happy path on active firm.
- Intake clarification path + completion path.
- Intake resume path (within window).
- Embed launcher mode and inline mode.
- Admin login/logout.
- Lead list -> lead detail -> status/assignment/note update.
- Firm settings save + intake/embed reflect branding updates.
- Invite create -> accept -> login.

## 8) Rollback awareness

- If migration involved, can app run safely with pre-change and post-change DB states?
- Any one-way data mutation or backfill? Document reversal strategy.
- If email/alert behavior changes, how to detect and recover from failed delivery quickly?

## 9) Final pre-merge check

- No duplicate business rules introduced in new files when an existing rule center exists.
- No cross-tenant leakage paths introduced.
- No stale docs introduced for changed behavior.
- Include "If we change X, also check Y and Z" note in PR description for future maintainers.
