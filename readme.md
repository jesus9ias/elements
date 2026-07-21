# Elements

An educational platform with two modes and a cross-cutting dictionary:

- **Periodic Table** — all 118 elements, colour-coded by category, with a detail view that includes a 3D Bohr-model animation built from each element's real electron configuration.
- **Molecule Visualizer** — a curated library of 20 molecules rendered in 3D from precomputed conformers, with search and per-molecule details.
- **Dictionary** — 47 terms per language, reachable from the navbar or from any contextual `?` icon.

Bilingual (Spanish default, English), offline-first: every piece of content is precomputed and committed, so the app never fetches data at runtime.

## Repository layout

```
elements/
├── spec.md            ← the master contract (read this first)
├── claude.md          ← working instructions for Claude Code
├── readme.md          ← this file
├── docs/
│   └── attribution.md ← data sources and licensing (CC0 / CC BY-SA / BSD)
├── frontend/          ← Astro + React + TypeScript + Three.js app, and the content pipeline
└── infra/             ← AWS CDK v2 stack that publishes the built site
```

Each subproject has its own `spec.md`, `claude.md` and `readme.md`.

## Status

| Area | State |
|---|---|
| `frontend/` Stages 1–7 | **Complete.** 21/21 tests green, `astro check` clean, build without warnings |
| Content | **Complete.** 118 elements, 20 molecules, 47 dictionary terms per language |
| `infra/` Stages 1–2 | Code-complete. `cdk synth` passes; **never deployed** |
| Deploy | Deliberately deferred. The GitHub Actions workflow only runs via `workflow_dispatch`; the `push` trigger is commented out |

Remaining work is validation rather than construction: a manual visual/QA pass (the 3D scenes and responsive behaviour are validated by hand, by design) plus a few flagged data gaps. See `frontend/readme.md`.

## Getting started

The app and the content pipeline both live in `frontend/`:

```bash
cd frontend
npm install
npm test        # 21 tests
npm run build   # production build
npm run preview # serve the build (use this, not `dev` — see frontend/claude.md)
```

Infrastructure is separate and is not needed to run the app locally — see `infra/readme.md`.

## Documentation map

| Question | File |
|---|---|
| What is this, and what are the rules? | `spec.md` |
| How should Claude Code work in this repo? | `claude.md` |
| How do I run the app or the content pipeline? | `frontend/readme.md` |
| What are the frontend's traps and conventions? | `frontend/claude.md` |
| How does the app get published? | `infra/readme.md` |
| Where does the data come from, and under what licence? | `docs/attribution.md` |

## Licensing of content

Element data comes from Wikidata (CC0) and Wikipedia (CC BY-SA 4.0); molecule identifiers from PubChem; 3D geometry is computed locally with RDKit (BSD-3). Text derived from Wikipedia carries a share-alike obligation. Full notice: [`docs/attribution.md`](docs/attribution.md).
