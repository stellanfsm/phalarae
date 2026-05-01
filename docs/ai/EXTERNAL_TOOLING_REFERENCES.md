# External Tooling References

This file tracks external repositories that should remain in Cursor context for this project.

## 1) Fallow

- Repository: https://github.com/fallow-rs/fallow
- Purpose: TypeScript/JavaScript codebase intelligence (dead code, duplication, complexity, architecture drift).
- Why it matters here: useful as a post-change quality gate for AI-generated edits and refactors.

### Practical usage

- Quick scan: `npx fallow --summary`
- PR-style checks: `npx fallow audit --format json`
- Cleanup preview: `npx fallow fix --dry-run --format json`

### Notes

- Static analysis is free/open-source.
- Runtime intelligence is optional and license-gated.

## 2) Claude Skills (mastepanoski)

- Repository: https://github.com/mastepanoski/claude-skills
- Purpose: installable skills for UX audits, accessibility, AI governance, and AI security assessments.
- Why it matters here: useful for structured UI/UX and AI-risk review workflows.

### Practical usage

- List skills: `npx skills add mastepanoski/claude-skills --list`
- Install one: `npx skills add mastepanoski/claude-skills --skill wcag-accessibility-audit`
- Install all: `npx skills add mastepanoski/claude-skills`

### Notes

- Treat this as an optional skill pack, not a replacement for project-specific rules.
- Prioritize WCAG/Nielsen skills for interface reviews and OWASP/NIST/ISO skills for AI feature governance.

## 3) Optiaxiom

- Repository: https://github.com/optimizely-axiom/optiaxiom
- Purpose: React implementation of Optimizely's Axiom Design System.
- Why it matters here: design-system reference for components, tokens, and conventions; includes MCP guidance for AI assistants.

### Practical usage

- Package install (consumer): `npm install @optiaxiom/react`
- MCP package mentioned in upstream docs: `npm install -g @optiaxiom/mcp`

### Notes

- Monorepo with apps and packages (`packages/react`, docs/storybook/figma apps).
- Useful when aligning admin UI consistency with a mature component system.

## Cursor integration policy

- Keep this file as the single external-reference index.
- Keep `docs/ai/PROJECT_MEMORY.md` linked to this file so agents can discover it quickly.
- When commands or APIs drift upstream, update this file first and avoid scattering references across multiple docs.
