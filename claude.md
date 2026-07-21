# Working instructions for Claude Code

These apply to the whole monorepo. Subprojects add their own in `frontend/claude.md` and `infra/claude.md`.

**Read `spec.md` (root) plus the relevant subproject `spec.md` before acting on any prompt.** The specs are the contract; this file is how to work within it.

---

## Hard rules

### 1. No external calls without direct authorization

Never execute a call to an external API or network service — **whether or not it costs money** — without the developer's explicit authorization for that specific run. This covers the Anthropic API, Wikidata, Wikipedia and PubChem equally.

Writing or editing a script that *would* make such a call needs no authorization; only running it does. Finish the code, then hand the run over. Do not offer to "just quickly verify" something against a live endpoint — propose it and wait.

Purely local scripts (RDKit embedding, the merge step, tests, builds) are not covered by this rule.

### 2. Git is the developer's

The developer runs `git init`, all commits and all pushes, at their own timing. **Never commit, never push, and never list committing as a pending item** in a status report. The spec's "generated and committed" wording describes the developer's workflow, not a task for Claude.

### 3. Stage discipline

Implementation proceeds in ordered stages defined per subproject, each ending in an explicit **STOP**. Do not begin the next stage without authorization, however obvious it seems.

*Current state: `frontend/` Stages 1–7 are complete. `infra/` Stages 1–2 are code-complete but the stack has never been deployed, deliberately.*

### 4. Tests-first

`frontend/` follows the TDD gate: Stage 2 authored every `T-*` test as a failing suite; later stages turned each subset green. The `T-*` tables in `frontend/spec.md` are **pre-authorized** — writing them needs no further approval. Explicit authorization is required to **add a test beyond the tables, or to modify or delete an existing one** (including changing only its import path).

The gate covers deterministic logic only. Visual/3D rendering and responsive behaviour are validated manually against the acceptance criteria in the spec.

### 5. No magic values

Every constant, enum and config key lives in a dedicated file (`src/constants/`, `.env`, or a `*.config.json`). No inline literals.

### 6. Sync discipline

`spec.md`, `claude.md` and `readme.md` are updated after any change that affects them. When a change contradicts existing documentation, **update the documentation first, then apply the change**.

### 7. Language

All code, comments, identifiers and documentation are in English. User-visible text lives only in the i18n layer.

---

## How to behave

- **Review-first.** When asked to review, audit or analyse, report findings only. Do not apply changes until told to.
- **Conflict detection.** If a proposed change contradicts the spec or a prior decision, stop and flag it. Do not resolve it unilaterally — several spec inconsistencies have been found this way, and each was worth the pause.
- **Nothing speculative.** Every feature traces back to a scenario in a `spec.md`. Do not write code "because the next stage will need it".
- **Provenance over convenience.** Content is extracted from citable sources, never generated from model knowledge. When a source genuinely lacks a value, record `null` and flag it — a visible gap beats a plausible invention. Where drafting from reference was unavoidable (54 electron configurations), the values are marked for developer verification in the data file itself.
- **Verify beyond the test.** A green test is not proof the feature works. Several bugs here passed their tests: the dictionary sort passed on an ASCII fixture while mis-ordering the real accented list; a batched Wikipedia fetch "succeeded" while silently losing 92% of its content. Check behaviour against real data.

## Decision log

Substantive decisions are recorded in the Decisions Log table of the relevant `spec.md`, with the reasoning. When superseding an earlier decision, add a new dated row that says so rather than editing history.
