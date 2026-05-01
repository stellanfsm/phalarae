# Triage Command Center v1 Implementation Plan

## 1. Milestone definition

### What it is
Triage Command Center v1 is the first product-completion milestone that turns Phalarae's stabilized intake + admin surfaces into a reliable day-to-day triage workspace for PI firms.

### Why it matters
Foundation hardening made core systems safer; this milestone makes those systems operationally coherent for real usage by improving triage clarity, reliability visibility, and firm go-live readiness flow.

### What success looks like
- Firm teams can identify priority leads quickly and process them with minimal ambiguity.
- Alert and delivery issues are visible and actionable in normal admin workflows.
- Firm setup to active go-live status feels like one coherent operator journey.
- No regressions in stabilized invariants (tenant safety, intake completion integrity, workflow consistency, embed parity).

## 2. Scope

### In scope
- Clarify triage cues and action hierarchy in existing lead list/detail surfaces.
- Improve visibility and actionability of existing lead alert reliability signals.
- Tighten coherence between firm readiness, status controls, and go-live/embed/intake handoff surfaces.
- Add targeted implementation-time guardrails and verification routines tied to existing systems.

### Out of scope
- Intake engine redesign (`app/api/intake/route.ts` orchestration model).
- New auth/session architecture or role-policy redesign.
- New major product modules (CRM, messaging hub, billing, portals).
- Queue/job infrastructure overhaul for alert delivery.
- Broad visual rebrand or UI redesign beyond milestone surfaces.

## 3. Primary workstreams

## Triage workflow clarity

- **Objective**
  - Make lead triage flow clearer and more decisive in existing admin lead surfaces.
- **Existing system**
  - Admin workflow + UI shell (`admin-workflow`, `ui-shell`).
- **Key repo surfaces/files likely involved**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `components/admin/LeadWorkflowControl.tsx`
  - `components/admin/LeadAssignControl.tsx`
  - `components/admin/LeadNoteInput.tsx`
  - `components/admin/StatusBadge.tsx`
  - `components/admin/PageHeader.tsx`
  - `lib/lead-workflow.ts`
  - `lib/summary.ts`
- **Change type**
  - `extends existing system`
- **Dependency warnings**
  - If we change lead list triage cues, also check lead detail action order and status badge semantics.
  - If we change workflow-control presentation, also check `app/admin/leads/[id]/actions.ts` and list filter/count behavior in `app/admin/leads/page.tsx`.
  - If we change summary/brief display placement, also check `lib/summary.ts` consumers in list and detail.

## Operational reliability visibility

- **Objective**
  - Make existing alert-delivery reliability states obvious and actionable for operators/admins without changing delivery architecture.
- **Existing system**
  - Intake completion side effects + admin workflow visibility (`intake`, `admin-workflow`).
- **Key repo surfaces/files likely involved**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `components/admin/StatusBadge.tsx`
  - `app/api/intake/route.ts` (read/verify behavior contracts; avoid redesign)
  - `lib/firm-display.ts`
  - `app/admin/firms/[id]/page.tsx`
- **Change type**
  - `extends existing system`
- **Dependency warnings**
  - If we change alert-status cues in leads UI, also check detail error display and badge mappings.
  - If we change configuration guidance for alert failures, also check firm settings surfaces and `resolveLeadAlertEmail` assumptions.
  - If we touch intake-side alert semantics, also check completion transaction and admin lead consumption paths.

## Firm readiness and go-live coherence

- **Objective**
  - Unify firm readiness, activation status, intake/embed entry points, and operator/admin guidance into a coherent go-live flow.
- **Existing system**
  - Firm workspace + embed/intake linkage (`admin-workflow`, `embed`).
- **Key repo surfaces/files likely involved**
  - `app/admin/firms/page.tsx`
  - `app/admin/firms/[id]/page.tsx`
  - `components/admin/FirmReadinessPanel.tsx`
  - `components/admin/FirmStatusControl.tsx`
  - `components/admin/FirmSettingsForm.tsx`
  - `lib/firm-readiness.ts`
  - `lib/firm-display.ts`
  - `app/embed/page.tsx`
  - `app/intake/[slug]/page.tsx`
- **Change type**
  - `extends existing system` (possible small `lightly restructures existing system` in readiness composition only)
- **Dependency warnings**
  - If we change readiness criteria/labels, also check status-control UX and firms list readiness hints.
  - If we change embed/go-live guidance copy/snippets, also check `app/embed/page.tsx` accepted params and intake/embed parity expectations.
  - If we change firm branding/go-live fields, also check `resolveFirmDisplay` and both public intake surfaces.

## 4. Cross-cutting implementation guardrails

- Completion-quality guardrails:
  - Keep intake completion invariants untouched: atomic session completion + lead creation + closing message; valid contact fields; 1:1 lead/session.
- Tenant/auth boundary preservation:
  - Any admin UI change must preserve route/action role boundaries already stabilized (`getAdminContext`, `requireFirmAccess`, role-based layouts).
- No duplicate business-rule ownership:
  - Reuse existing rule centers (`lib/lead-workflow.ts`, `lib/firm-readiness.ts`, `lib/firm-display.ts`, `lib/summary.ts`) instead of page-local duplicates.
- Workflow/status consistency preservation:
  - Any status-related UI change must align list filters, detail controls, and badge mappings together.
- Embed parity awareness where relevant:
  - Any firm go-live/edit guidance affecting embed must cross-check `/embed` and `/intake/[slug]` behavior and snippet assumptions.
- Scope discipline:
  - No new major subsystems; avoid queue/auth/intake-engine redesign in this milestone.

## 5. Proposed ticket set

### Ticket 1 — Lead Inbox Action Hierarchy Pass
- **Goal**
  - Improve triage clarity on `Leads` list so priority and next action are immediately obvious.
- **Scope**
  - Existing list page information hierarchy, cue ordering, and action affordance alignment; no new workflow states.
- **Likely files**
  - `app/admin/leads/page.tsx`
  - `components/admin/StatusBadge.tsx`
  - `components/admin/PageHeader.tsx`
- **Dependency checks**
  - If list cue logic changes, also check lead detail top badges and workflow control assumptions.
  - If status badge usage changes, also check badge mappings used in firms/lead detail.
- **Verification expectations**
  - Manual role pass (operator, firm_admin, firm_staff) on leads list.
  - Verify status filters and new-lead cue behavior unchanged semantically.
- **Classification**
  - `extends`

### Ticket 2 — Lead Detail Triage Console Coherence
- **Goal**
  - Make the lead detail page feel like a coherent triage console (status, assignment, notes, reliability context).
- **Scope**
  - Reorder/refine existing detail sections and cues for operational clarity; preserve business behavior.
- **Likely files**
  - `app/admin/leads/[id]/page.tsx`
  - `components/admin/LeadWorkflowControl.tsx`
  - `components/admin/LeadAssignControl.tsx`
  - `components/admin/LeadNoteInput.tsx`
- **Dependency checks**
  - If detail cue placement changes, also check list->detail handoff expectations and workflow action outcomes.
  - If notes/assignment presentation changes, also check server actions and permission assumptions.
- **Verification expectations**
  - Manual flow: list -> detail -> status update -> assignment -> note add.
  - Confirm `new -> open` first-view behavior remains intact.
- **Classification**
  - `extends`

### Ticket 3 — Alert Reliability Visibility Tightening
- **Goal**
  - Make alert delivery issues operationally clear and consistently surfaced where triage decisions happen.
- **Scope**
  - Existing `alertStatus`/`alertError` display and guidance coherence across lead list/detail and related cues.
- **Likely files**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `components/admin/StatusBadge.tsx`
  - `app/admin/firms/[id]/page.tsx` (guidance cross-linking only)
- **Dependency checks**
  - If alert labels/cues change, also check intake completion path writes and badge semantics.
  - If firm guidance links/copy changes, also check firm settings and readiness panel coherence.
- **Verification expectations**
  - Validate visibility for `sent`, `failed`, `no_recipient` scenarios.
  - Confirm no regression in lead-detail error rendering.
- **Classification**
  - `extends`

### Ticket 4 — Firm Readiness-to-Activation Narrative Alignment
- **Goal**
  - Align firm list/detail readiness cues with activation controls and go-live expectations.
- **Scope**
  - Improve coherence across readiness panel, status control, and supporting copy/actions; no policy redesign.
- **Likely files**
  - `app/admin/firms/page.tsx`
  - `app/admin/firms/[id]/page.tsx`
  - `components/admin/FirmReadinessPanel.tsx`
  - `components/admin/FirmStatusControl.tsx`
  - `lib/firm-readiness.ts`
- **Dependency checks**
  - If readiness messaging/criteria change, also check operator-only status controls and list hints.
  - If go-live cues change, also check public intake/embed status gating expectations.
- **Verification expectations**
  - Manual operator flow: pending firm -> resolve blockers -> activate -> verify cues update coherently.
- **Classification**
  - `extends`

### Ticket 5 — Go-Live Surface Coherence (Intake + Embed handoff)
- **Goal**
  - Ensure firm detail go-live links/snippets and public entry behavior remain coherent and trustworthy.
- **Scope**
  - Tighten handoff clarity between firm settings, intake URL, embed URL/snippets, and status-gating expectations.
- **Likely files**
  - `app/admin/firms/[id]/page.tsx`
  - `app/embed/page.tsx`
  - `lib/embed-params.ts`
  - `app/intake/[slug]/page.tsx`
- **Dependency checks**
  - If snippet guidance changes, also check actual `/embed` query parameter behavior.
  - If intake/embed URL handling changes, also check firm status gating and middleware/layout embed chain assumptions.
- **Verification expectations**
  - Manual check: copy snippets -> render embed launcher/inline -> compare with documented expectations.
  - Confirm inactive/pending firms remain gated.
- **Classification**
  - `lightly restructures`

## 6. Recommended execution order

1. Ticket 1 — Lead Inbox Action Hierarchy Pass  
2. Ticket 2 — Lead Detail Triage Console Coherence  
3. Ticket 3 — Alert Reliability Visibility Tightening  
4. Ticket 4 — Firm Readiness-to-Activation Narrative Alignment  
5. Ticket 5 — Go-Live Surface Coherence (Intake + Embed handoff)

Rationale: establish triage command center core first (list/detail), then reliability visibility, then readiness/go-live coherence.

## 7. Verification plan

### After each ticket group

- **After Tickets 1-2 (triage clarity)**
  - Leads list filters (`new/open/contacted/archived`) and cue behavior.
  - Lead detail transitions (`new -> open`), assignment, notes.
  - Role pass on nav/surface visibility (operator vs firm_admin vs firm_staff).

- **After Ticket 3 (reliability visibility)**
  - Alert badge/error visibility consistency on list/detail.
  - Scenario checks for `sent`, `failed`, `no_recipient`.
  - Cross-check firm settings guidance for resolving delivery/config states.

- **After Tickets 4-5 (readiness/go-live coherence)**
  - Firms list/detail readiness messaging consistency.
  - Activation workflow coherence for operators.
  - Intake/embed links/snippets match actual runtime behavior.
  - Embed launcher/inline and full-page intake gating for inactive/pending firms.

### Milestone-end regression checks

- Full manual matrix from `docs/ai/FOUNDATION_HARDENING_AUDIT_MATRIX.md` for affected areas:
  - Admin login/logout
  - Lead list/detail workflow + notes/assignment
  - Firm settings and status gating
  - Embed launcher/inline parity
  - Intake completion-to-lead integrity signals as consumed in admin

## 8. Definition of done

- All 5 tickets completed without scope creep into intake/auth redesign.
- Triage list/detail surfaces are operationally coherent and role-aware.
- Alert reliability states are consistently visible and actionable in admin workflows.
- Firm readiness and activation/go-live guidance are coherent across firms list/detail and public surface expectations.
- No duplicate rule ownership introduced outside existing centers.
- Manual verification plan completed with no critical regressions.
- `docs/ai/FOUNDATION_HARDENING_AUDIT_MATRIX.md` updated with any new findings/fixes from milestone execution.

