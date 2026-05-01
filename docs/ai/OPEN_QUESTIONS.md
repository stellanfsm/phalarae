# Open Questions (Strategic / Architectural)

## Product and policy boundaries

- Is global `AdminUser.email` uniqueness intentional long-term policy, or should one person be able to belong to multiple firms?
- What are the required data retention and deletion policies for `IntakeMessage` transcripts and `Lead` summaries?
- What auditability requirements are expected for admin actions (status changes, assignment changes, note edits)?

## Intake engine and quality

- Should there be automated tests that lock intake step invariants (`FLOW_SEQUENCE`, conditional skips, completion rules) before adding more branching?
- Is the current force-accept strategy acceptable for production risk posture, or should certain fields require explicit human fallback before completion?
- What is the expected behavior if OpenAI is degraded for long periods (current deterministic fallback exists, but no explicit observability/SLA policy is documented)?

## Multi-tenant and auth safety

- Should auth/authorization logic be further centralized (policy layer) to reduce drift between middleware, layouts, and server actions?
- Are there requirements for stricter session controls (session cap per user, forced periodic re-auth, org-wide revoke)?

## Operations and reliability

- Should alert email sending move to a retryable queue/job path rather than synchronous best-effort update after lead creation?
- What operational monitoring is expected for lead alert failures (`alertStatus = failed`), beyond admin UI visibility?

## Documentation drift and source-of-truth

- `docs/GO_LIVE.md` previously referenced `config/firm.ts`, which is not present in the repo. A minimal correction was made, but should docs include an explicit "DB-driven branding only" statement as a policy to prevent reintroduction of file-based config assumptions?
- Is there a canonical architecture document expected by the team (to avoid future split-brain between code and docs), or should `docs/ai/ARCHITECTURE_MAP.md` become that source?
