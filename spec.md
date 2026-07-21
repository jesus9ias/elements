# Elements — Monorepo Spec

This is the master contract for the entire `elements` monorepo. It defines the shared working discipline for Claude Code, the repository structure, the subprojects it governs, and the cross-cutting decisions that apply everywhere.

Each subproject (`infra/spec.md`, `frontend/spec.md`) inherits this contract in full. In case of conflict between this document and a subproject spec, **this document takes precedence** unless a deviation is explicitly declared in the subproject's own `Deviations from Monorepo Contract` section.

Read this file, together with the relevant subproject `spec.md`, before acting on any prompt.

---

## Objective

Elements is an educational platform with two primary modes:

1. **Periodic Table** — the classic table up to element 118, color-coded by category, with a detail view per element including a 3D Bohr-model animation.
2. **Molecule Visualizer** — a curated library of molecules rendered in 3D (atoms as spheres, bonds as cylinders), browsable and searchable.

A cross-cutting **Dictionary** modal explains key concepts, reachable from the navbar or from contextual `?` icons anywhere in the interface.

## General Style

Glassmorphism across the interface. No special runtime mitigation is planned for its GPU cost beyond the performance guards already defined for the 3D scenes (see `frontend/spec.md`), since the site is not view-heavy.

## Repository Structure

```
elements/
├── spec.md              ← this file
├── claude.md             ← Claude Code working instructions (root)
├── readme.md              ← repo overview, links to subproject readmes
├── docs/
│   └── attribution.md    ← Wikidata/Wikipedia attribution notice (general, not per-entity)
├── infra/
│   ├── spec.md
│   ├── claude.md
│   └── readme.md
└── frontend/
    ├── spec.md
    ├── claude.md
    └── readme.md
```

## Subprojects

| Subproject | Responsibility |
|---|---|
| `infra/` | AWS CDK v2 stack to publish the frontend to a subdomain |
| `frontend/` | Astro + React + TypeScript + Three.js app: both modes, content pipeline scripts, i18n, dictionary |

## Working Style for Claude Code

- **Spec-first:** every feature implemented must trace back to a Gherkin scenario defined in the applicable subproject `spec.md`. Nothing is implemented speculatively.
- **Stage discipline:** implementation is divided into ordered stages, defined per subproject. Begin with Stage 1. Do not proceed to the next stage without explicit developer authorization, even if the next stage seems obvious or trivial.
- **TDD gate (tests-first stages):** for any subproject that defines a `T-*` test suite (currently `frontend/`), implementation is preceded by a dedicated **failing-test stage** that authors every test from that subproject's `T-*` tables at once — all red, with no implementation behind them. Each subsequent implementation stage then turns its designated `T-*` subset green; no implementation code is added that is not already covered by a written failing test. The `T-*` tables are the **pre-authorized** test set: writing them inside the designated failing-test stage needs no further authorization. Explicit developer authorization is required only to (a) add a test not listed in the `T-*` tables, or (b) modify or delete an existing test. The gate covers **deterministic logic only**; visual/3D rendering and scaffold/presentational code are explicitly **out of scope** for automated tests and are validated manually against the acceptance criteria defined in `frontend/spec.md`. Subprojects without a `T-*` suite (e.g. `infra/`) are exempt from the failing-test stage and rely on their own review method (`cdk synth` / `cdk diff`).
- **Review-first:** when asked to review, audit, inspect, or analyze code or documentation, report findings only. Do not apply changes until the developer explicitly confirms.
- **Conflict detection:** if a proposed change contradicts existing documentation or a prior decision, stop, alert the developer, and wait for confirmation. If confirmed, update the documentation first, then apply the change.
- **No magic values:** all constants, enums, and config keys are declared in dedicated files (`constants/`, `.env`, or `*.config.json`). No inline literal values anywhere.
- **Sync discipline:** `spec.md`, `claude.md`, and `readme.md` (root and per-subproject, as applicable) are updated after every change that affects them.
- **Language:** all code, comments, identifiers, and documentation are written in English. User-visible text lives only in the i18n layer (see `frontend/spec.md`).
- **No external calls without direct authorization:** Claude Code never executes a call to an external API or network service — **whether or not it incurs cost** — without the developer's explicit, direct authorization for that specific run. This covers paid endpoints (the Anthropic API used by `summarize.ts`) and free ones alike (Wikidata SPARQL, Wikipedia, PubChem). Claude writes and reviews the scripts; the developer decides when they run and runs them. Writing or modifying a script that *would* make such a call is allowed and needs no authorization — only executing it does.

## Environment & Secrets Policy

All sensitive values (AWS credentials, Route53 host, subdomain, region, ACM certificate ARN, Anthropic API key for the content pipeline) live exclusively in `.env` files, never committed. `.env.example` files with placeholder keys are committed instead.

## Global Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-17 | Two-mode platform: Periodic Table + Molecule Visualizer, sharing a navbar, i18n engine, and Dictionary modal | Single cohesive educational product instead of two disconnected tools |
| 2026-07-17 | Glassmorphism as the general visual style, no special runtime mitigation beyond existing 3D performance guards | Site is not view-heavy enough to justify extra complexity |
| 2026-07-17 | Spanish as default language; user selection persists in `localStorage` and takes precedence from then on | Matches primary audience; simple, well-understood pattern |
| 2026-07-17 | URLs are in English, no language prefix | Not a requirement for this project; keeps routing simple |
| 2026-07-17 | No granular cache invalidation strategy for the MVP; every deploy invalidates the full CloudFront distribution | Simpler to reason about; can be revisited if deploy frequency grows |
| 2026-07-18 | Claude Code executes no external API/network call — paid or free — without direct per-run developer authorization; it authors the scripts, the developer runs them | The developer wants control over when data is fetched and when spend is incurred, and wants to inspect pipeline output before it propagates. Applies to the Anthropic API, Wikidata, Wikipedia and PubChem alike, so the rule needs no case-by-case judgement about cost |
| 2026-07-17 | Tests-first stage model: a dedicated failing-test stage authors all of a subproject's `T-*` tests (red) before any implementation; later stages turn each subset green. `T-*` tables are pre-authorized; only tests beyond the tables, or edits to an existing test, need authorization | Matches the discipline used in prior projects; removes per-test authorization friction while keeping the test set under explicit control |

## Open / Tracked Items

| # | Item | Status |
|---|---|---|
| 1 | Color/pattern accessibility check for bond styles and element category colors (contrast, color-blindness) | **Closed 2026-07-18 (frontend Stage 7).** All category colors measured at WCAG AA or better; three hue-adjacent pairs widened in hue and lightness; category is always also conveyed as text. Bond styles are distinguished by geometry (1/2/3 cylinders, solid vs dashed), not colour, so they are unaffected by colour vision. Findings recorded in the `frontend/spec.md` Decisions Log |

## Cross-References

- `infra/spec.md` — AWS CDK publishing strategy
- `frontend/spec.md` — data model, content pipeline, both modes, Gherkin, unit tests, implementation stages
- `docs/attribution.md` — Wikidata (CC0) / Wikipedia (CC-BY-SA) attribution notice
