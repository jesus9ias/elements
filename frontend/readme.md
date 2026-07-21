# Elements — Frontend

The Astro + React + TypeScript + Three.js app, and the local content pipeline that produces the data it ships with.

See [`spec.md`](spec.md) for the contract and [`claude.md`](claude.md) for conventions and traps.

## Stack

Astro 7 · React 19 · TypeScript 6 · Vite · Vitest 4 · Three.js 0.185 · i18next 26 + react-i18next 17 · Node 24.
Content pipeline only: Python 3.10 + RDKit 2026.3.4, and the Anthropic API (Claude Haiku).

> TypeScript is pinned to 6.x on purpose: `@astrojs/check` still declares a peer of `typescript@^5 || ^6`.

## Setup

```bash
npm install
```

For the molecule pipeline only (not needed to run the app):

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r scripts/requirements.txt
```

Copy `.env.example` to `.env` and fill `ANTHROPIC_API_KEY` if you intend to run the summarization steps.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Vitest suite (21 tests). **Run from this directory.** |
| `npm run test:watch` | Watch mode |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built site — **use this to validate, not `dev`** |
| `npm run check` | `astro check` (types + Astro diagnostics) |
| `npm run dev` | Dev server; see the caveat in `claude.md` |

## How content works

Everything the app displays is **precomputed and committed** to `src/config/`, and imported (bundled) at build time. Nothing is fetched at runtime, so there are no loading or error states for content.

```
data/raw/         fetched source material (Wikidata claims, Wikipedia extracts)
data/generated/   AI-extracted prose — never hand-edited
data/curated/     hand-maintained input and overrides — always wins
      ↓  (local scripts, run on demand)
src/config/       elements.{es,en}.json · molecules.json · common.json
      ↓  (imported by the app)
```

Curated values override generated ones **field by field**, so re-running a fetch never clobbers a manual correction.

### Pipeline runbook

These scripts are local developer tools. They are **never** run by CI/CD, and only need re-running when content actually changes.

**Elements**

```bash
node --experimental-strip-types scripts/fetch-elements.ts --all      # or --element=Fe
node --env-file=.env --experimental-strip-types scripts/summarize.ts --all   # ~236 API calls
node --experimental-strip-types scripts/merge.ts
```

**Molecules**

```bash
node --experimental-strip-types scripts/fetch-molecules.ts
node --env-file=.env --experimental-strip-types scripts/summarize-molecules.ts  # ~40 API calls
.\.venv\Scripts\python.exe scripts\embed-molecules.py
```

**One-off seeding**

```bash
node --experimental-strip-types scripts/fetch-isotopes.ts --probe    # inspect Wikidata's model
node --experimental-strip-types scripts/fetch-isotopes.ts            # then seed
```

Fetch steps are **resumable**: already-fetched text is never re-fetched and progress is saved even when some requests fail, so a rate-limited run just needs re-running until it converges.

Every script fails loudly, listing the offending element or molecule by id, and writes nothing broken.

## Content status

| | |
|---|---|
| Elements | 118, both languages, with prose, isotopes and electron configurations |
| Molecules | 20, with 3D conformers and prose |
| Dictionary | 47 terms per language, hand-written |

### Known gaps (flagged, not silent)

Records with missing data carry `needsReview: true` rather than a plausible-looking guess.

- **28 elements have no `atomicMass`** — synthetics and radioactives with no IUPAC standard atomic weight. Convention is to show the most stable isotope's mass number in brackets; not implemented.
- **~39 element records** flagged overall: the above, plus elements known since antiquity (no discovery date), missing discoverers, and `uses` the source article didn't cover.
- **1 molecule** (`pyridine`) has no Spanish `uses` — its ES article doesn't cover them.
- **37 electron configurations** in `data/curated/electron-configurations.json` are listed under `$needsVerification` (f-block and superheavies) and should be checked against an authoritative source. Wikidata only has a P8000 claim for 64 of 118 elements.

## Testing

21 tests cover deterministic logic only — data merge, bond classification, i18n fallback, element data, molecule search, dictionary ordering and filtering. 3D rendering, layout and responsive behaviour are validated manually against the acceptance criteria in `spec.md`.
