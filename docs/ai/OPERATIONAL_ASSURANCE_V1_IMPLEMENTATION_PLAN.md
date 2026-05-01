# Operational Assurance v1 Implementation Plan

## 1. Milestone definition

### What it is
Operational Assurance v1 is a focused milestone to improve trust in daily use of Phalarae’s existing intake-to-triage workflow by making accountability, reliability diagnostics, and operator confidence signals clearer inside current admin surfaces.

### Why it matters now
Triage Command Center v1 improved workflow coherence. The next gap is assurance: teams need clearer evidence of what happened, what failed, and what needs operator action, without changing core runtime behavior.

### What success looks like
- Admin users can quickly understand lead handling state and recent operational actions.
- Reliability issues (delivery/config states) are diagnosable and actionable without digging through ambiguous UI states.
- Operators can assess system health/trust cues from existing surfaces with minimal guesswork.
- No regressions in hardened invariants (tenant boundaries, intake completion integrity, workflow semantics, embed parity).

## 2. Scope

### In scope
- Strengthen lead-handling accountability cues in existing lead list/detail surfaces.
- Improve visibility/interpretation of existing reliability states and related corrective guidance.
- Improve operator confidence cues in existing admin dashboards/pages using current data and semantics.
- Add only lightweight structure/presentation improvements on top of existing behavior.

### Out of scope
- Async job/queue/retry platform work.
- CRM expansion or new pipeline modules.
- Auth/session architecture redesign.
- Intake engine rewrite or state-machine redesign.
- Broad analytics platform buildout.
- New notification backends or delivery infrastructure.

## 3. Primary workstreams

## Lead handling accountability

- **Objective**
  - Make it clearer who handled what and where a lead stands operationally, using existing workflow/assignment/note primitives.
- **Existing system**
  - `admin-workflow` + `ui-shell`.
- **Key repo surfaces/files likely involved**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `components/admin/LeadWorkflowControl.tsx`
  - `components/admin/LeadAssignControl.tsx`
  - `components/admin/LeadNoteInput.tsx`
  - `components/admin/StatusBadge.tsx`
- **Change type**
  - `extends existing system`
- **Dependency warnings**
  - If we change lead accountability cues in list, also check detail triage sections and workflow badge semantics.
  - If we change detail action context, also check list-to-detail handoff and action outcomes from `app/admin/leads/[id]/actions.ts`.
  - If we change note/assignee visibility wording/order, also check role constraints and existing server action validations.

## Reliability diagnostics visibility

- **Objective**
  - Make reliability states (especially alert outcomes and config-linked issues) easier to interpret and troubleshoot within current admin flow.
- **Existing system**
  - Intake completion side-effects + admin lead/firm visibility (`intake`, `admin-workflow`).
- **Key repo surfaces/files likely involved**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `components/admin/StatusBadge.tsx`
  - `app/admin/firms/[id]/page.tsx`
  - `lib/firm-display.ts`
- **Change type**
  - `extends existing system`
- **Dependency warnings**
  - If we adjust alert-state interpretation text, also check `StatusBadge` labels and lead detail error rendering.
  - If we adjust remediation guidance, also check firm settings fields and `resolveLeadAlertEmail` precedence assumptions.
  - If we touch reliability cues in leads pages, also check Ticket-3 delivery filters and actionability paths.

## Operator confidence cues

- **Objective**
  - Provide concise “can I trust this workspace right now?” signals in existing operator-facing surfaces.
- **Existing system**
  - Firms admin + leads operational summaries (`admin-workflow`).
- **Key repo surfaces/files likely involved**
  - `app/admin/firms/page.tsx`
  - `app/admin/firms/[id]/page.tsx`
  - `components/admin/FirmReadinessPanel.tsx`
  - `components/admin/FirmStatusControl.tsx`
  - `app/admin/leads/page.tsx`
- **Change type**
  - `lightly restructures existing system`
- **Dependency warnings**
  - If we adjust confidence cue hierarchy on firms pages, also check readiness/status semantics from `lib/firm-readiness.ts`.
  - If we add operator-oriented confidence summaries on leads page, also check role-based visibility and no-staff leakage.
  - If we adjust go-live confidence language, also check actual active-gating behavior in `/intake/[slug]` and `/embed`.

## 4. Cross-cutting implementation guardrails

- Preserve intake/runtime behavior:
  - No changes to `app/api/intake/route.ts` state machine semantics or completion transaction guarantees.
- Preserve role/tenant boundaries:
  - All admin surface updates remain consistent with `getAdminContext()` and `requireFirmAccess()` constraints.
- No duplicate workflow logic:
  - Reuse existing status/routing centers (`lib/lead-workflow.ts`, `components/admin/StatusBadge.tsx`) rather than redefining state domains in pages.
- No premature infrastructure expansion:
  - Do not introduce queues, retry workers, event buses, or new notification pipelines in this milestone.
- Keep inside existing surfaces:
  - Leads/firms/account/admin views only; no new product surface families.
- Maintain embed/intake parity assumptions:
  - If any go-live confidence copy references public availability, verify against existing `/intake/[slug]` and `/embed` status gating.

## 5. Proposed ticket set

### Ticket 1 — Lead Accountability Timeline Signals
- **Goal**
  - Improve visibility of operational handling state on lead detail (reviewed/contacted/assignment/note context) without changing behavior.
- **Scope**
  - Clarify and normalize handling timeline cues in lead detail and linked list context.
- **Likely files**
  - `app/admin/leads/[id]/page.tsx`
  - `app/admin/leads/page.tsx`
  - `components/admin/StatusBadge.tsx`
- **Dependency checks**
  - If timeline/status copy changes, also check list badges and workflow controls.
  - If reviewed/contact cues are surfaced differently, verify no change to status transition semantics.
- **Verification expectations**
  - Manual lead flow: list -> detail -> status update -> assignment -> note.
  - Confirm accountability cues update coherently without semantic drift.
- **Classification**
  - `extends`

### Ticket 2 — Reliability State Explainability Pass
- **Goal**
  - Make `sent` / `failed` / `no_recipient` states more self-explanatory and reduce troubleshooting ambiguity.
- **Scope**
  - Improve reliability-state explanatory text/cues and remediation links in leads list/detail using existing state fields.
- **Likely files**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `components/admin/StatusBadge.tsx`
  - `app/admin/firms/[id]/page.tsx`
- **Dependency checks**
  - If alert cue text changes, also check firm settings guidance and `resolveLeadAlertEmail` assumptions.
  - If list filters/counters are refined, ensure existing Ticket-3 filter semantics remain consistent.
- **Verification expectations**
  - Validate explainability for `sent`, `failed`, `no_recipient` scenarios.
  - Verify lead-to-firm remediation handoff remains role-appropriate.
- **Classification**
  - `extends`

### Ticket 3 — Operator Assurance Snapshot
- **Goal**
  - Add concise operator-facing confidence snapshot in existing admin surfaces using current metrics/signals.
- **Scope**
  - Compose a small confidence summary from existing counts/statuses/readiness signals; no new analytics subsystem.
- **Likely files**
  - `app/admin/leads/page.tsx`
  - `app/admin/firms/page.tsx`
  - `app/admin/firms/[id]/page.tsx`
  - `components/admin/FirmReadinessPanel.tsx`
- **Dependency checks**
  - If confidence snapshot references readiness/go-live, also verify active-gating behavior in public routes.
  - If role-targeted visibility is added, check operator vs firm-admin/staff boundaries.
- **Verification expectations**
  - Manual role pass (operator, firm_admin, firm_staff) for visibility correctness.
  - Ensure snapshot statements match underlying existing state/counters.
- **Classification**
  - `lightly restructures`

### Ticket 4 — Cross-Surface Assurance Copy Alignment
- **Goal**
  - Align reliability/accountability/go-live wording across leads and firms surfaces to reduce contradictory guidance.
- **Scope**
  - Harmonize message language only where it affects operational trust and actionability.
- **Likely files**
  - `app/admin/leads/page.tsx`
  - `app/admin/leads/[id]/page.tsx`
  - `app/admin/firms/[id]/page.tsx`
  - `components/admin/FirmReadinessPanel.tsx`
- **Dependency checks**
  - If wording references status semantics, also check `StatusBadge` labels and workflow helpers.
  - If wording references public availability, verify against `/intake/[slug]` and `/embed` active gating.
- **Verification expectations**
  - Cross-page copy walk-through for consistency and actionability.
  - Confirm no wording implies features/behaviors that do not exist.
- **Classification**
  - `extends`

## 6. Recommended execution order

1. Ticket 1 — Lead Accountability Timeline Signals  
2. Ticket 2 — Reliability State Explainability Pass  
3. Ticket 3 — Operator Assurance Snapshot  
4. Ticket 4 — Cross-Surface Assurance Copy Alignment

Rationale: establish concrete lead-level accountability first, then reliability diagnostics, then operator-level summary, then finalize language coherence.

## 7. Verification plan

### Manual testing after each ticket group

- **After Ticket 1**
  - Lead list/detail handling cues remain coherent.
  - Workflow/assignment/notes operations unchanged.
  - `new -> open` first-view behavior remains intact.

- **After Ticket 2**
  - Reliability states remain correct and more understandable on list/detail.
  - Delivery filters/counters still match existing semantics.
  - Remediation links land on correct firm settings context.

- **After Ticket 3**
  - Operator confidence snapshot visibility is role-correct.
  - Snapshot statements match underlying existing system state.
  - No spillover into new analytics/platform behavior.

- **After Ticket 4**
  - Wording consistency across leads/firms views.
  - No contradictory guidance between readiness/reliability/go-live messages.

### Milestone-end regression checks

- Admin login/logout/session paths still behave as expected.
- Lead list/detail workflow + assignment + notes semantics unchanged.
- Alert status visibility and remediation navigation intact.
- Firm readiness and status activation paths unchanged.
- Public intake/embed active-gating behavior unchanged.
- `docs/ai/FOUNDATION_HARDENING_AUDIT_MATRIX.md` updated for any new findings/fixes.

## 8. Definition of done

- All 4 tickets are completed without scope drift into infrastructure/platform work.
- Admin users can interpret lead handling accountability and reliability state with low ambiguity.
- Operator confidence cues exist and are grounded in existing system data/semantics.
- No new duplicate rule ownership is introduced.
- No changes to intake engine behavior, auth architecture, workflow semantics, or public runtime capabilities.
- Manual verification plan passes with no critical regressions.
