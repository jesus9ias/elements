# Elements — Frontend Spec

> Inherits the full contract defined in the monorepo `spec.md` at the repository root. In case of conflict, the monorepo `spec.md` takes precedence unless a deviation is explicitly declared below.

## Deviations from Monorepo Contract

None at this time.

## Stack

- Astro (latest)
- React (latest)
- TypeScript (strict, latest)
- Vite (latest)
- Vitest (latest)
- Three.js (latest) — 3D rendering for both the atomic Bohr-model animation and the molecule visualizer
- i18next + react-i18next (latest) — EN/ES support
- Node 24
- Python 3 + RDKit (native library, **not** RDKit.js/WASM) — local-only tooling, run on-demand by the developer for the molecule content pipeline (see below); never part of the deployed app or the CI/CD build
- Anthropic API (Claude Haiku) — local-only tooling, run on-demand by the developer for summarizing unstructured Wikipedia text into structured description/uses/characteristics fields; never part of the deployed app or the CI/CD build

Desktop and mobile support are considered from the start of implementation, not retrofitted.

## Environment Variables

```
# .env (never committed)
ANTHROPIC_API_KEY=
# infra-related vars consumed at deploy time live in infra/.env, not here
```

## Repository Structure (within `frontend/`)

```
frontend/
├── spec.md
├── claude.md
├── readme.md
├── scripts/
│   ├── fetch-elements.ts          # Wikidata + Wikipedia fetch, full-run or --element=<symbol>
│   ├── fetch-molecules.ts         # PubChem CID → Wikidata (P662) → Wikipedia extracts per lang
│   ├── summarize-molecules.ts     # Claude Haiku extraction of molecule description/uses
│   ├── fetch-isotopes.ts          # one-time seeding of curated/isotopes.json from Wikidata
│   ├── electron-configuration.ts  # expands Wikidata P8000 spectroscopic notation to per-shell counts
│   ├── summarize.ts               # Claude Haiku summarization step (raw → generated)
│   ├── merge.ts                   # generated + curated overrides → final elements.{lang}.json
│   ├── embed-molecules.py         # RDKit ETKDG + MMFF/UFF, bond classification, CPK colors
│   ├── bond_constants.py          # Python reader for src/constants/bonds.json + RDKit bond-type map
│   ├── embed_constants.py         # paths and tuning for embed-molecules.py
│   └── requirements.txt           # Python deps for the local-only molecule pipeline (RDKit)
├── data/
│   ├── raw/                       # cached raw fetch output
│   │   ├── <lang>/<Symbol>.json   #   elements, per element/lang
│   │   └── molecules.<lang>.json  #   molecules, keyed by id (only 20, so one file per lang)
│   ├── generated/                 # Claude Haiku summaries — never hand-edited
│   │   ├── <lang>/<Symbol>.json   #   elements
│   │   └── molecules.<lang>.json  #   molecules (description/uses)
│   ├── curated/
│   │   ├── overrides/             # manual field-level overrides, per lang: overrides/<lang>/<Symbol>.json
│   │   ├── isotopes.json          # seeded once by fetch-isotopes.ts, then hand-curated
│   │   ├── electron-configurations.json  # fallback for the 54 elements Wikidata lacks P8000 for
│   │   └── molecules.source.json  # hand-maintained SMILES + metadata; its i18n text OVERRIDES generated
│   └── dictionary/
│       └── terms.{es,en}.json     # 100% manual, no script involved
├── src/
│   ├── config/                     # final merged pipeline output, imported (bundled) by the app
│   │   ├── elements.es.json        # final merged output, consumed by the app
│   │   ├── elements.en.json
│   │   ├── molecules.json          # includes precomputed 3D conformers + bond styles
│   │   └── common.json             # language-agnostic values (symbols, SMILES, numbers)
│   ├── components/                 # React islands (Navbar, periodic-table/, molecule/, …)
│   ├── constants/                  # all non-magic values (i18n, routes, three, app, bonds)
│   │   ├── bonds.json              # bond order→style + CPK table; read by bonds.ts AND by Python
│   │   ├── bonds.ts                # types + accessors over bonds.json (T-BOND-* target)
│   │   ├── molecule-types.json     # molecule `type` vocabulary; read by molecules.ts AND by Python
│   │   ├── molecules.ts            # Molecule record types + accessors over molecule-types.json
│   │   └── categories.ts           # atomic number → element category (Stage 4 data; Stage 5 adds colors)
│   ├── i18n/
│   │   ├── config.ts               # i18next init (tested behavior implemented in Stage 3)
│   │   └── resources/              # UI strings: common.json (language-agnostic) + es.json + en.json
│   ├── layouts/                    # Astro layout shells (BaseLayout)
│   ├── pages/                      # Astro routes (index = periodic table, /molecules)
│   ├── styles/                     # tokens.css (glassmorphism tokens) + global.css
│   ├── three/                      # shared Three.js scene lifecycle utility (mount/animate/dispose)
│   └── utils/                      # shared helpers (text.ts: accent-insensitive search normalization)
└── docs/
    └── attribution.md             # symlink/reference to the root docs/attribution.md content
```

> **Two distinct `common.json` files, by design:** `src/i18n/resources/common.json` holds language-agnostic **UI** values (brand name, language labels) consumed by i18next as the `common` namespace; `src/config/common.json` holds language-agnostic **content** values (chemical symbols, SMILES, numeric fields) produced by the content pipeline. They are unrelated despite the shared name.

## Data Model

### Element (per language file, keyed by atomic number)

```json
{
  "atomicNumber": 26,
  "symbol": "Fe",
  "name": "Hierro",
  "group": "transition-metal",
  "atomicMass": 55.845,
  "meltingPointC": 1538,
  "meltingPointK": 1811,
  "boilingPointC": 2862,
  "boilingPointK": 3135,
  "discoveryDate": "Antigüedad",
  "discoverer": null,
  "halfLife": null,
  "knownIsotopes": ["Fe-54", "Fe-56", "Fe-57", "Fe-58"],
  "electronConfiguration": ["2", "8", "14", "2"],
  "description": "...",
  "uses": "...",
  "characteristics": "...",
  "sources": [
    { "label": "Wikidata", "url": "https://www.wikidata.org/wiki/Q1063" },
    { "label": "Wikipedia (es)", "url": "https://es.wikipedia.org/wiki/Hierro" }
  ],
  "needsReview": false
}
```

`electronConfiguration` is an ordered array of electrons per shell, sourced from the Wikidata electron-configuration claim (P8000) when present (including known exceptions such as Chromium/Copper), never derived from a simplified 2n² rule.

**Format note (confirmed against the live endpoint):** Wikidata stores P8000 as *spectroscopic notation with a noble-gas core* — Chromium is `"[Ar] 3d⁵ 4s¹"`, not an array. `scripts/electron-configuration.ts` therefore expands the noble-gas core and sums electrons per principal shell to produce `["2","8","13","1"]`. This is a faithful deterministic conversion of the real claim, which is exactly why genuine exceptions survive — no Aufbau/2n² rule is ever applied.

### Molecule (language-agnostic core + per-language text)

```json
{
  "id": "glucose",
  "formula": "C6H12O6",
  "smiles": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
  "type": "sugar",
  "isomers": ["fructose", "galactose"],
  "atoms": [
    { "element": "C", "x": 0.0, "y": 0.0, "z": 0.0, "color": "#909090" }
  ],
  "bonds": [
    { "from": 0, "to": 1, "order": "single", "style": "solid" },
    { "from": 1, "to": 2, "order": "aromatic", "style": "solid+dashed" }
  ],
  "i18n": {
    "es": { "name": "Glucosa", "description": "...", "uses": "..." },
    "en": { "name": "Glucose", "description": "...", "uses": "..." }
  },
  "sources": [{ "label": "PubChem CID 5793", "url": "..." }],
  "needsReview": false
}
```

`name` is hard data and always required. `description`/`uses` may be `null` while the
text is still pending, which sets `needsReview: true` — the same visible-and-actionable
convention the element pipeline uses, rather than a placeholder string that would render
literally in the UI.

`atoms`/`bonds` coordinates and bond styles are **precomputed locally, on-demand**, by `embed-molecules.py`, and the result is committed to `src/config/molecules.json`. No embedding runs in the browser, and none runs as part of the CI/CD build, for the MVP.

Bond `order` → visual `style` mapping (fixed rule, not per-molecule):

| SMILES bond order | Visual style |
|---|---|
| Single | 1 solid cylinder |
| Double | 2 parallel solid cylinders |
| Triple | 3 parallel solid cylinders |
| Aromatic | 1 solid cylinder + 1 dashed cylinder (delocalization, not Kekulé) |
| Ionic | Out of scope for this stage |

Atom colors follow the standard CPK convention.

### Dictionary term

```json
{ "term": "SMILES", "definition": "..." }
```

100% manually curated per language, no script.

## Content Pipeline (local, on-demand — not part of the CI/CD build)

These scripts are **never executed by GitHub Actions or by any deploy step**. They run locally, only when the developer is adding or updating an element or molecule. Their output (`src/config/*.json`) is committed to the repository like any other source file, and is imported (bundled) by the app rather than fetched at runtime — which is why it lives under `src/`, not `public/` (see 2026-07-18 Decisions Log). The CI/CD pipeline (see `infra/spec.md`) only builds and deploys the Astro app against whatever JSON is already committed — it does not fetch, summarize, merge, or embed anything itself.

1. `fetch-elements.ts --element=<symbol>` or `--all` — run locally; pulls structured facts from Wikidata (SPARQL) and raw Wikipedia extracts (ES/EN separately, not machine-translated) into `data/raw/`.
2. `summarize.ts` — run locally; sends each raw Wikipedia extract to Claude Haiku with a strict extraction-only prompt (no invented content; return `null` if a field isn't present in the source text) to produce `description`/`uses`/`characteristics` into `data/generated/`.
3. `merge.ts` — run locally; combines **three** inputs **field by field** into the final `src/config/elements.{lang}.json`: `raw/` (hard data), `generated/` (extracted prose) and `curated/overrides/` (manual corrections, which win per field, not per element). It also fills `group` from `src/constants/categories.ts`, `knownIsotopes` from `data/curated/isotopes.json`, and builds each record's `sources` array from the Wikidata ID and Wikipedia URL in `raw/`. Sets `needsReview: true` whenever a required field is missing after merge, and prints every flagged record with its missing fields. Finally writes `src/config/common.json`, the language-agnostic convenience index.
4. `fetch-molecules.ts` — run locally; resolves each molecule's Wikipedia article **without guessing titles**: its verified PubChem CID → Wikidata (property P662) → that item's ES/EN sitelinks → plain-text extracts into `data/raw/molecules.{lang}.json`. A molecule whose CID has no Wikidata item can pin its article by hand via an optional `"wikipedia": { "es": …, "en": … }` field in `molecules.source.json`, which always wins over the lookup. The run is **resumable**: already-fetched text is never re-fetched, and progress is written even when some requests fail, so a rate-limited run just needs re-running until it converges.
5. `summarize-molecules.ts` — run locally; same extraction-only contract as `summarize.ts` (never invent; return `null` when the source text doesn't cover a field) to produce `description`/`uses` into `data/generated/molecules.{lang}.json`.
6. `embed-molecules.py` — run locally; reads `data/curated/molecules.source.json` (hand-maintained SMILES list), runs RDKit `AddHs` → `EmbedMolecule` (ETKDG) → MMFF/UFF optimization, extracts 3D atom coordinates, classifies bonds per the table above, merges the molecule text **field by field — curated text wins, generated fills the gaps** — appends the Wikipedia articles the prose derives from to each molecule's `sources`, and writes `src/config/molecules.json`.
7. Any embedding or merge failure **fails loudly at the local script level**, listing the offending element/molecule by ID. The developer resolves it and re-commits before the next deploy — the committed JSON is expected to always be valid; CI/CD has no knowledge of, and does not re-validate, the pipeline that produced it.

**When to re-run:** only when content actually changes (a new molecule added, an element field corrected, a new isotope discovered, etc.), not on every deploy. A frontend-only change (UI, styling, logic) never triggers these scripts.

Isotopes: populated automatically when present as a Wikidata claim; otherwise filled manually in the override layer.

Attribution: each element/molecule's `sources` array links back to its Wikidata/Wikipedia/PubChem origin (doubles as the "learn more" link). The general CC0/CC-BY-SA attribution notice lives in `docs/attribution.md`, referenced from the root `spec.md` and `readme.md` rather than duplicated inline.

## i18n Rules

- Default language: Spanish. User selection persists in `localStorage` and takes precedence on every subsequent visit.
- Missing translation: render a visible placeholder (e.g. "Traducción pendiente") rather than a silent fallback — acceptable since content is validated before publishing and this should rarely surface.
- Language-agnostic values (SMILES, chemical symbols, numeric fields) live in `common.json`, outside the `es`/`en` blocks.
- URLs are in English, no language prefix.

## Periodic Table Mode

- Classic layout up to element 118, cells colored by category (alkali metals, noble gases, rare earths, etc.).
- Each cell shows: symbol, name, atomic number, atomic mass.
- **Desktop:** hovering a cell enlarges/overlaps it for quick readability.
- **Mobile:** the hover-enlarge effect does not apply; a tap opens the detail view directly. Horizontal scroll is used for the grid instead of forcing it to fit narrow viewports.
- Clicking/tapping a cell opens the detail view:
  - **Desktop:** right-hand sidebar.
  - **Mobile:** full-screen modal / bottom sheet.
  - Contents: 3D Bohr-model animation (nucleus with individual protons/neutrons, electrons in real shells per the Wikidata electron configuration, continuous motion at uniform angular speed for all electrons), prev/next navigation without closing the view, element cell thumbnail, name, group, short description, atomic number, atomic mass, melting/boiling points (°C and K), discovery date and discoverer, half-life, known isotopes, main uses, main characteristics, sources, "learn more" link.

### Nucleus/Electron Rendering Rule

- Every proton, neutron, and electron is rendered as an individual particle (not a single blob), matching the reference visual (dense red/blue nucleus cluster, dotted concentric electron shells).
- Rendered via `THREE.InstancedMesh` (protons, neutrons, electrons each as their own instanced group) to keep draw calls low even for elements with hundreds of particles.
- The previous element's scene (geometry + materials) is fully disposed before the next one is built when navigating via prev/next or re-selecting a cell — no accumulation across navigations.
- **Acceptance criterion:** Uranium (92 protons + ~146 neutrons + 92 electrons, ~330 particles) must be validated on a mid-tier mobile device before this approach is signed off. If performance doesn't hold, the documented fallback is a single grouped nucleus blob with a particle-count label instead of individual spheres.

## Molecule Visualizer Mode

### Inventory (left column, two tabs)

- **List tab:** alphabetical list of molecules with a text search input.
- **Info tab:** shown automatically after selecting a molecule; displays name, chemical formula, SMILES formula (with a note that it's the source of the 3D representation), short description, type (acid/sugar/base), isomers, uses, sources. Returning to the List tab preserves the current selection.
- No molecule is selected by default.
- Selecting a molecule updates the Viewer with its 3D structure.
- Empty state: a clear message when the search filter matches nothing.

### Viewer

- Atoms rendered as spheres (CPK colors, size varies per element), bonds rendered as cylinders per the bond-style table above.
- Geometry comes entirely from the precomputed `molecules.json` conformer data — no client-side embedding for the MVP.
- Same rotate/zoom interaction pattern already validated in the methane prototype (manual orbit control, since `THREE.OrbitControls` isn't available in this Three.js build in some environments — confirm availability at implementation time and use it if present, otherwise reuse the manual drag/wheel controller).

## Dictionary

- Modal, alphabetically organized, with a text filter input.
- Opens from the top navbar, or directly from any contextual `?` icon elsewhere in the UI (e.g. next to "SMILES" in the molecule info tab), landing pre-scrolled/filtered to that specific term.
- Content is 100% manually curated (`data/dictionary/terms.{es,en}.json`), no fetch script involved.

## General Features

- Top navbar: switch mode (Periodic Table / Molecule Visualizer), switch language, open Dictionary modal.
- EN/ES support, persisted in `localStorage` as described above.

## Gherkin Feature Specifications

All scenarios below are defined up front and do not change after Stage 1 without explicit developer authorization.

```gherkin
Feature: Language selection
  Scenario: First visit with no stored preference
    Given the user has no language preference in localStorage
    When the app loads
    Then the interface renders in Spanish by default

  Scenario: Returning visit with a stored preference
    Given the user previously selected English
    When the app loads
    Then the interface renders in English without re-detecting browser language

  Scenario: Missing translation for a field
    Given an element's "uses" field has no English translation
    When the user views that element in English
    Then a visible "translation pending" placeholder is shown for that field only

Feature: Periodic table browsing
  Scenario: Hovering a cell on desktop
    Given the user is on a desktop viewport
    When the user hovers over an element cell
    Then the cell enlarges/overlaps neighboring cells to show its data clearly

  Scenario: Tapping a cell on mobile
    Given the user is on a mobile viewport
    When the user taps an element cell
    Then the detail view opens directly as a full-screen modal, with no hover/enlarge intermediate step

  Scenario: Navigating between elements without closing the detail view
    Given the element detail view is open
    When the user presses the "next" arrow
    Then the view updates to show the next element's data and 3D animation
    And the previous element's Three.js scene is fully disposed before the new one renders

Feature: Molecule search and selection
  Scenario: No molecule selected by default
    Given the user opens the Molecule Visualizer for the first time in a session
    Then no molecule is selected and the viewer is empty

  Scenario: Selecting a molecule from the list
    Given the user is on the inventory's List tab
    When the user clicks a molecule
    Then the inventory switches to the Info tab showing that molecule's data
    And the viewer renders its 3D structure

  Scenario: Returning to the list preserves selection
    Given a molecule is selected and the Info tab is showing
    When the user switches back to the List tab
    Then the previously selected molecule remains selected

  Scenario: Search with no results
    Given the user types a search term matching no molecule
    Then an empty-state message is shown in place of the list

Feature: Bond rendering
  Scenario: Rendering a double bond
    Given a molecule's SMILES defines a double bond between two atoms
    Then the viewer renders two parallel solid cylinders between those atoms

  Scenario: Rendering an aromatic bond
    Given a molecule's SMILES defines an aromatic bond
    Then the viewer renders one solid cylinder plus one dashed cylinder between those atoms

Feature: Dictionary
  Scenario: Opening from the navbar
    Given the user clicks the Dictionary icon in the navbar
    Then a modal opens showing all terms alphabetically with a filter input

  Scenario: Opening from a contextual "?" icon
    Given the user clicks the "?" icon next to "SMILES" in the molecule info tab
    Then the Dictionary modal opens already scrolled/filtered to the "SMILES" term

Feature: Content pipeline integrity (local script run)
  Scenario: A molecule fails 3D embedding
    Given a SMILES string in molecules.source.json cannot be embedded by RDKit
    When the developer runs embed-molecules.py locally
    Then the script fails loudly, listing the offending molecule id
    And no partial/broken molecule data reaches src/config/molecules.json
    And nothing is committed until the developer fixes the source SMILES

  Scenario: Field-level override precedence
    Given an element has a manually curated "description" override in Spanish
    And Wikidata's melting point value changes on a subsequent fetch
    When merge.ts runs again
    Then the melting point is updated from the fresh Wikidata data
    And the manually curated description remains untouched
```

## Unit Test Definitions

Visual/3D rendering is explicitly out of scope for these tables (see Working Style in the monorepo spec); it is validated manually via the acceptance criteria stated in this document. The tables below cover deterministic logic only.

### Data Merge Logic (`T-DATA-NN`)

| Test ID | Objective | Input | Expected Output |
|---|---|---|---|
| T-DATA-01 | Field-level override wins over generated content | Generated description + curated override for the same field | Override value is used |
| T-DATA-02 | Non-overridden fields stay dynamic | Generated field with no override, changed on re-fetch | New generated value is used, not stale |
| T-DATA-03 | Missing required field sets `needsReview` | Merged element missing `discoverer` | `needsReview: true` |
| T-DATA-04 | Fully complete element does not get flagged | Merged element with all required fields present | `needsReview: false` |
| T-DATA-05 | `--element=<symbol>` scopes the fetch to a single element | CLI arg `--element=Fe` | Only `Fe`'s raw/generated files are touched |

### Bond Classification (`T-BOND-NN`)

| Test ID | Objective | Input | Expected Output |
|---|---|---|---|
| T-BOND-01 | Single bond maps to solid style | SMILES bond order: single | `style: "solid"`, 1 cylinder |
| T-BOND-02 | Double bond maps to parallel solid style | SMILES bond order: double | `style: "solid-parallel"`, 2 cylinders |
| T-BOND-03 | Triple bond maps to parallel solid style | SMILES bond order: triple | `style: "solid-parallel"`, 3 cylinders |
| T-BOND-04 | Aromatic bond maps to solid+dashed style | SMILES bond order: aromatic | `style: "solid+dashed"` |
| T-BOND-05 | Atom color follows CPK convention | Atom element: O | `color: "#FF0000"` (or the project's defined CPK red) |

### Element Data Model (`T-ELEM-NN`)

| Test ID | Objective | Input | Expected Output |
|---|---|---|---|
| T-ELEM-01 | Electron configuration sourced from Wikidata claim | Element with a Wikidata electron-configuration claim (e.g. Chromium) | Configuration matches the claim's exception, not the simplified rule |
| T-ELEM-02 | Category color mapping is deterministic | Element group: "noble-gas" | Cell renders with the noble-gas color token |

### Molecule Search (`T-MOL-NN`)

| Test ID | Objective | Input | Expected Output |
|---|---|---|---|
| T-MOL-01 | Search filters case/accent-insensitively | Query: "acido" against "Ácido acético" | Match returned |
| T-MOL-02 | Empty search result triggers empty state | Query matching no molecule | Empty-state message rendered |
| T-MOL-03 | Selecting a molecule switches inventory tab | Click on a list item | Info tab becomes active, List tab preserves selection on return |

### i18n (`T-I18N-NN`)

| Test ID | Objective | Input | Expected Output |
|---|---|---|---|
| T-I18N-01 | Default language with no stored preference | No localStorage key | Renders in Spanish |
| T-I18N-02 | Stored preference takes precedence | localStorage set to "en" | Renders in English regardless of browser language |
| T-I18N-03 | Missing translation renders placeholder | Field with no `en` value | Visible "translation pending" placeholder |

### Dictionary (`T-DICT-NN`)

| Test ID | Objective | Input | Expected Output |
|---|---|---|---|
| T-DICT-01 | Alphabetical ordering | Unordered terms list | Rendered alphabetically |
| T-DICT-02 | Filter narrows the list | Query: "smi" | Only matching terms shown |
| T-DICT-03 | Deep-link opens filtered to a specific term | `?` icon next to "SMILES" clicked | Modal opens pre-filtered/scrolled to "SMILES" |

## Implementation Stages

Implementation proceeds in strict order. Each stage ends with an explicit **STOP** — do not begin the next stage without developer authorization, even if it seems like a natural continuation.

This subproject follows the **tests-first stage model** (see the monorepo `spec.md` TDD gate): Stage 1 scaffolds the project, **Stage 2 authors every `T-*` test as a failing (red) suite with no implementation**, and Stages 3–7 each turn their designated `T-*` subset green. Writing the `T-*` tests inside Stage 2 needs no extra authorization; adding a test beyond the `T-*` tables, or editing an existing test, does.

### Stage 1 — Project Foundation

**Scope:** repository scaffold, tooling, base layout, navbar shell, design tokens, shared Three.js scene lifecycle utility. No `T-*` logic is implemented here — this stage only makes the app boot as an empty shell and the test runner run.

**Deliverables:**
- Astro + React + TS + Vite + Vitest setup, Node 24, strict TS config
- Folder structure as defined above
- i18next + react-i18next installed and the provider mounted, with the `common` / `es` / `en` resource-file structure scaffolded. The **tested** i18n behaviors (default-Spanish resolution, `localStorage` precedence, placeholder-on-missing) are deliberately deferred to Stage 3 so their tests start red.
- Navbar shell: mode switch, language switch, Dictionary trigger — all presentational and wired, with no behavior yet (i18n behavior lands in Stage 3, the Dictionary modal in Stage 7)
- Glassmorphism design tokens (colors, blur values, spacing)
- Routing skeleton, English-only URLs
- `src/three/scene-lifecycle.ts` — reusable mount/animate/dispose utility, built once and reused by both the Bohr-model animation (Stage 5) and the molecule viewer (Stage 6)
- `.env.example`

**Validation:** `vitest` is configured and executes; app boots on desktop and mobile viewport with an empty shell; no hardcoded literals outside constants/config files. No `T-*` tests exist yet, so none are required to pass.

**STOP — await explicit developer authorization before continuing to Stage 2.**

### Stage 2 — Failing Test Suite

**Scope:** author every deterministic test from the `T-*` tables at once. **All must fail (no implementation).** No production code is written in this stage.

**Deliverables (all red):**
- `src/i18n/__tests__/i18n.test.ts` — `T-I18N-*`
- `scripts/__tests__/merge.test.ts` — `T-DATA-*`
- `src/constants/__tests__/bonds.test.ts` — `T-BOND-*`
- `src/components/periodic-table/__tests__/element-data.test.ts` — `T-ELEM-01`
- `src/components/periodic-table/__tests__/categories.test.ts` — `T-ELEM-02`
- `src/components/molecule/__tests__/search.test.ts` — `T-MOL-*`
- `src/components/dictionary/__tests__/dictionary.test.ts` — `T-DICT-*`

**Validation:** `vitest` runs and every listed test fails for the right reason (missing implementation / unresolved import), none pass, and none fail for an unintended reason (syntax error, misconfigured runner). No implementation code is added.

**STOP — await explicit developer authorization before continuing to Stage 3.**

### Stage 3 — i18n Engine

**Scope:** implement the i18next behavioral configuration that turns `T-I18N-*` green.

**Deliverables:**
- Default language Spanish when no stored preference exists
- `localStorage` persistence and precedence: a stored preference wins; otherwise Spanish is the default. The browser's language is **intentionally never consulted** — a first visit always starts in Spanish (per the i18n decisions + Gherkin "without re-detecting browser language").
- Placeholder-on-missing ("Traducción pendiente") via i18next's `parseMissingKeyHandler`, with `fallbackLng: false` so a missing translation is visible rather than silently filled from another language
- `common` namespace (language-agnostic values) split from the `es` / `en` blocks
- Navbar language switch now functional and persistent across reloads (stored preference applied on the client after mount, keeping the SSR first render deterministic)

**Validation:** `T-I18N-*` go green; manual desktop/mobile check that switching language persists across reloads.

**STOP — await explicit developer authorization before continuing to Stage 4.**

### Stage 4 — Content Pipeline (local tooling)

**Scope:** all data-generation scripts and their outputs. These are local developer tools, run on-demand — never part of the CI/CD build (see the Content Pipeline section above). Their committed output is what the UI consumes from Stage 5 onward. Turns `T-DATA-*`, `T-BOND-*`, and `T-ELEM-01` green.

**Deliverables:**
- `scripts/fetch-elements.ts` (full-run and `--element=<symbol>`)
- `scripts/summarize.ts` (Claude Haiku extraction-only prompt)
- `scripts/merge.ts` (field-level override, `needsReview` flagging)
- `src/constants/bonds.json` (bond order→style map + CPK colors — the single source of truth) and `src/constants/bonds.ts` (types + `bondStyleFor`/`cpkColor` accessors over it; `T-BOND-*` test this module)
- `scripts/embed-molecules.py` (RDKit ETKDG + MMFF/UFF, bond classification and CPK colors read from `bonds.json` via `scripts/bond_constants.py`, loud failure on bad input)
- `data/curated/molecules.source.json` populated with the ~20 MVP molecules' SMILES and metadata
- `data/dictionary/terms.{es,en}.json` manually populated
- `docs/attribution.md`
- Final `src/config/elements.{es,en}.json`, `molecules.json`, `common.json` generated and committed

**Validation:** `T-DATA-*`, `T-BOND-*`, and `T-ELEM-01` pass; a full local pipeline run completes for all 118 elements and all MVP molecules with zero silent failures; any embedding/merge failure is confirmed to halt the local script run with a clear offending-ID message, before anything is committed.

**STOP — await explicit developer authorization before continuing to Stage 5.**

### Stage 5 — Periodic Table Mode

**Scope:** full periodic table grid and element detail view (sidebar on desktop, modal on mobile), including the Bohr-model 3D animation. Turns `T-ELEM-02` green.

**Deliverables:**
- Grid component with category coloring, hover-enlarge (desktop) / tap-to-open (mobile), horizontal scroll on mobile
- Detail view (sidebar/modal) with all specified fields, prev/next navigation
- Bohr-model animation: `InstancedMesh` for protons/neutrons/electrons, continuous uniform-speed electron motion, full dispose-on-navigation

**Validation:** `T-ELEM-02` passes (category color mapping deterministic); manual acceptance test on Uranium on a mid-tier mobile device per the documented criterion; dispose behavior confirmed via memory profiling across several consecutive navigations.

**STOP — await explicit developer authorization before continuing to Stage 6.**

### Stage 6 — Molecule Visualizer Mode

**Scope:** inventory (list/info tabs, search), 3D viewer consuming precomputed `molecules.json` data. Turns `T-MOL-*` green.

**Deliverables:**
- Inventory component with tab-switch-on-select and selection-preserving-on-return behavior
- Search with empty-state handling
- Viewer component rendering atoms/bonds per the bond-style table, reusing the Stage 1 scene-lifecycle utility, with orbit/zoom interaction

**Validation:** `T-MOL-*` unit tests pass; manual visual check across all ~20 MVP molecules for correct bond styling (single/double/triple/aromatic) and CPK coloring.

**STOP — await explicit developer authorization before continuing to Stage 7.**

### Stage 7 — Dictionary, Accessibility & Responsive Polish

**Scope:** Dictionary modal, contextual `?` deep-links, accessibility review, final responsive pass, cross-cutting QA. Turns `T-DICT-*` green.

**Deliverables:**
- Dictionary modal: alphabetical list, filter input, deep-link-to-term behavior from any `?` icon
- Accessibility review of bond-style and element-category color choices (contrast, color-blindness), documented findings and any resulting adjustments
- Final responsive pass: sidebar↔modal breakpoints, periodic table horizontal scroll, glassmorphism rendering on low-end devices
- Full cross-feature manual QA checklist run (both modes, both languages)

**Validation:** `T-DICT-*` unit tests pass; accessibility findings documented in the Decisions Log (this section) with any changes made; manual QA checklist signed off.

**STOP — this is the final stage. Confirm sign-off with the developer before considering the MVP complete.**

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-17 | Wikidata for structured facts, Wikipedia + Claude Haiku for free-text fields | Structured claims need no AI; free text needs extraction, not generation, to avoid hallucination |
| 2026-07-17 | Raw / generated / curated-overrides pipeline, merged field by field | Allows re-running data fetches without losing manual edits, at maximum granularity |
| 2026-07-17 | Isotopes from Wikidata when present, manual fallback otherwise | Wikidata coverage for isotopes is inconsistent; not worth full automation |
| 2026-07-17 | Claude Haiku as the first choice for the summarization step | One-off job (236 calls total), cost is marginal either way; Haiku tried first for speed/cost, upgradeable to Sonnet if quality falls short |
| 2026-07-17 | `needsReview` flag instead of silent nulls | Makes missing-data cases visible and actionable instead of discovered by chance |
| 2026-07-17 | Attribution links stored per-entity in `sources`, general notice centralized in `docs/attribution.md` | Keeps per-entity JSON small; avoids duplicating the CC0/CC-BY-SA notice everywhere |
| 2026-07-17 | Bohr model with real per-element shell configuration (Wikidata-sourced), not the simplified 2n² rule | More accurate without added manual effort, since the data is already available as a claim |
| 2026-07-17 | Electrons animate continuously at uniform angular speed (not per-shell-differentiated) | Simpler to implement, matches the reference visual, good enough for the educational goal |
| 2026-07-17 | Full individual-particle nucleus (protons/neutrons) rendering via `InstancedMesh`, with Uranium as the worst-case acceptance benchmark | Matches the desired reference visual; instancing plus an explicit fallback plan manages the performance risk |
| 2026-07-17 | MVP scope: ~20 curated molecules, no arbitrary SMILES input | Keeps the pipeline local-only and avoids shipping RDKit/WASM to the browser |
| 2026-07-17 | 3D geometry generated via RDKit ETKDG + MMFF/UFF, never derived from the 2D layout algorithm | 2D layout is a drawing convention (flattened by design); 3D needs real distance/angle-based embedding to reflect actual non-planar geometry |
| 2026-07-17 | Molecule embedding runs in Python (native RDKit), executed locally by the developer on-demand, not RDKit.js in the browser and not as a CI/CD build step | Avoids WASM runtime cost entirely for the MVP; native RDKit is the more mature, better-documented implementation for a one-off, infrequent batch job; deploys stay fast since they never re-run data generation |
| 2026-07-17 | Bond styles: single = 1 solid cylinder, double/triple = N parallel solid cylinders, aromatic = 1 solid + 1 dashed (delocalization), ionic out of scope | Matches standard visualizer conventions for single/double/triple; aromatic gets a physically-honest custom style instead of forcing Kekulé; ionic bonds aren't representable directly from SMILES connectivity and are deferred |
| 2026-07-17 | CPK standard color palette for atoms | Widely recognized convention, no need to reinvent for an educational tool |
| 2026-07-17 | Content pipeline errors surface only when the developer runs the scripts locally, loudly, listing offending IDs — never at CI/CD build time, since CI/CD never runs these scripts | MVP has no runtime loading/error states for content since everything is precomputed and committed; keeps both the runtime UI and the deploy pipeline simple |
| 2026-07-17 | Dictionary is 100% manually curated, no fetch script | Small, controlled list of concepts; automation would add complexity without real benefit |
| 2026-07-17 | Mobile: no hover-enlarge equivalent; tap opens the detail view directly. Horizontal scroll for the periodic table grid on mobile | Hover has no touch equivalent; horizontal scroll preserves the table's real proportions instead of cramming it |
| 2026-07-17 | Sidebar (desktop) becomes a full-screen modal/bottom-sheet on mobile | Standard responsive pattern for detail panels on narrow viewports |
| 2026-07-17 | Spanish default language, `localStorage` persists user choice thereafter; visible placeholder (not silent fallback) for missing translations; URLs in English with no language prefix | Matches primary audience; missing-translation cases should be rare and visible rather than silently masked; URL localization isn't a requirement for this project |
| 2026-07-17 | No granular CloudFront invalidation strategy for the MVP | Deploy frequency doesn't yet justify the added complexity |
| 2026-07-17 | Automated tests cover deterministic logic only (merge, bond classification, i18n fallback, search); visual/3D rendering is validated manually against documented acceptance criteria | Consistent with the project's established TDD discipline, applied where it adds real value |
| 2026-07-17 | i18next + react-i18next as the i18n engine (not a custom engine) | Named default in the spec; standard and well-supported; default-language and `localStorage` precedence are largely configuration, and placeholder-on-missing is handled via its missing-key hooks |
| 2026-07-17 | Tests-first stage model applied to `frontend/`: Stage 2 authors all `T-*` tests red, Stages 3–7 turn each subset green; i18n behavioral config was moved out of Stage 1 into Stage 3 so its `T-I18N-*` tests start red | Matches prior-project discipline; keeps the test set explicit while removing per-test authorization friction |
| 2026-07-17 | Bond order→style map + CPK colors live in a single TS constants module (`src/constants/bonds.ts`), consumed by the renderer and mirrored by `embed-molecules.py`; `T-BOND-*` test this module | One authoritative mapping under test (no-magic-values), even though the Python pipeline is what writes the resolved styles into `molecules.json` |
| 2026-07-17 | Stack pinned to latest at Stage 1 scaffold time: Astro 7, React 19, Three.js 0.185, i18next 26 + react-i18next 17, Vitest 4. **TypeScript pinned to 6.0.3, not 7** | "latest" honored across the stack; TS 7 (native port) is held back only because `@astrojs/check` still declares peer `typescript@^5 || ^6` — revisit when the Astro toolchain supports TS 7 |
| 2026-07-17 | UI i18n strings live in `src/i18n/resources/` (`common`/`es`/`en`), separate from the content-level `public/config/common.json` | The spec's folder tree did not locate UI strings; placing them under `src/i18n/` keeps them with the engine and distinct from pipeline-produced content |
| 2026-07-17 | i18n initial-language resolution is stored-preference-or-Spanish; browser language is never consulted. Missing translations use `parseMissingKeyHandler` + `fallbackLng: false` (visible placeholder, no silent fallback) | `T-I18N-01` runs under jsdom (`navigator.language = en-US`); consulting the browser would wrongly resolve to English on first visit. Matches the Gherkin "without re-detecting browser language" and the visible-placeholder rule. Corrects the earlier Stage 3 wording that mentioned "browser detection" |
| 2026-07-18 | `T-ELEM-02` moved out of `element-data.test.ts` into its own `categories.test.ts`; assertions unchanged, only the file boundary and imports moved | Both `T-ELEM` tests shared one file with two module-level imports, so `T-ELEM-01` (Stage 4) could not load without `categoryColor` (Stage 5) existing. Stage 4's own validation criterion was therefore unreachable without writing speculative Stage 5 code, which the monorepo contract forbids. Splitting restores what the spec already intended — Stage 4 turns `T-ELEM-01` green, Stage 5 turns `T-ELEM-02` green — rather than renegotiating either stage |
| 2026-07-18 | Element `group` comes from `src/constants/categories.ts` (atomic number → category, all 118, with a load-time guard that every element is categorized exactly once), not from Wikidata. Stage 4 owns the data; Stage 5 adds `categoryColor()` and the CSS tokens to the same file | Wikidata's category modelling is inconsistent across elements, while category membership is fixed, well-established reference data. `group` is a required field, so without a local source every element would be flagged `needsReview` |
| 2026-07-18 | Molecule `description`/`uses` are **extracted from Wikipedia**, not hand-written and not AI-generated — extending the element pattern (`fetch-molecules.ts` + `summarize-molecules.ts` → `data/generated/molecules.{lang}.json`). Curated text in `molecules.source.json` still wins field by field. **Supersedes** the original "i18n text is hand-maintained" reading of the molecule source file | The spec already ruled that free text needs *extraction, not generation*, to avoid hallucination; molecules were the one place that principle was not applied. Only ~40 Haiku calls. Article titles are never guessed: the verified PubChem CID resolves through Wikidata P662 to the item's ES/EN sitelinks, so provenance is mechanical |
| 2026-07-18 | Each molecule's `sources` gains the ES/EN Wikipedia articles its prose derives from, alongside its PubChem entry | Wikipedia is CC BY-SA: text derived from an article must link that article. PubChem alone no longer covers the attribution once prose comes from Wikipedia |
| 2026-07-18 | **Stage 7 accessibility review — contrast.** All 10 element-category colors pass WCAG AA (≥4.5:1) as text against both background stops; the lowest is 5.75:1. Body text 14.3:1, muted 7.4:1, accent 6.5:1. No contrast change was needed | Measured programmatically against the tokens rather than judged by eye, so the result is reproducible when the palette changes |
| 2026-07-18 | **Stage 7 accessibility review — color-blindness.** Three category pairs were too close to separate by hue alone (alkaline-earth/transition both yellow, nonmetal/halogen both blue, lanthanide/actinide both pink). Widened all three in BOTH hue and lightness: worst-case perceptual separation went from 0.100 to 0.181 while every category stayed AA. **Colour is never the sole carrier of category** — the detail view always names the category in text, satisfying WCAG 1.4.1 | Ten categories on one dark background is genuinely constrained; separating in lightness as well as hue helps dichromatic viewers, and the textual category name means nothing is lost if the colours are indistinguishable. Closes tracked item #1 in the monorepo spec |
| 2026-07-18 | **Stage 7 accessibility — semantics.** Element cells carry an explicit `aria-label` ("name, symbol X, atomic number N") instead of the raw concatenation of their spans; the grid uses `role="group"`, not `role="grid"` | `role="grid"` promises arrow-key grid navigation that is not implemented — a labelled group of individually-named buttons is the honest semantic |
| 2026-07-18 | The Dictionary modal is its own island mounted by `BaseLayout`; the navbar button and every contextual `?` icon reach it through a window `CustomEvent` (`elements:dictionary-open`), optionally carrying the term to pre-filter to | Astro islands are separate React roots and cannot share state directly. A single shared event keeps the modal mounted once while any island can open it, including deep-linking to a term |
| 2026-07-18 | `sortTerms` orders with `localeCompare`, never `<` | The Spanish list has three entries starting with "Á" (Ácido, Ángstrom, Átomo); a code-point sort pushes them past "Z", to the very end of the list. `T-DICT-01`'s fixture uses only ASCII initials, so a broken sort would have passed the test while the real modal rendered wrong — verified against the real data |
| 2026-07-18 | Pipeline output lives in `src/config/`, not `public/config/`. Corrects the original folder tree | The app imports the JSON (bundled, offline-first, no runtime fetch — per the "no runtime loading states" decision). Vite treats `public/` as served-as-is assets, so importing from there both warns and DUPLICATES the ~450 kB of JSON (once copied to the build output, once inlined in the JS). `src/` is the correct home for imported source data. Surfaced during Stage 5 when the periodic grid first imported the element JSON. Touched `merge.ts`, `embed-molecules.py`, `element-data.ts`, and the `element-data.test.ts` import path |
| 2026-07-18 | Wikidata has a P8000 electron-configuration claim for only 64/118 elements (confirmed genuinely absent for 54, not a query/rank bug). The 54 are filled from a curated `data/curated/electron-configurations.json` holding real spectroscopic notation, fed through the SAME `electronsPerShell` parser as the Wikidata claims | Keeps the spec's "never derived from a 2n²/Aufbau rule" guarantee — the fallback is authentic ground-state data (exceptions written into the notation), just sourced from a reference table instead of Wikidata, and it reuses the tested parser. Computing the 54 from a rule was rejected: they include Cu/Ag/Au and the entire exception-heavy f-block, exactly where a rule is wrong. f-block + superheavy entries are flagged `$needsVerification` pending a check against an authoritative source |
| 2026-07-18 | `discoveryDate` stores the discovery **year** parsed from Wikidata P575. BCE dates and unparseable values become `null` rather than invented text | Rendering an era ("a. C." / "Antigüedad") is language-dependent text, which belongs in the i18n layer or an override, never in a value synthesized by the pipeline. Elements known since antiquity have no P575 claim at all, so they arrive `null` and are flagged for review — visible rather than fabricated |
| 2026-07-18 | Molecules carry `needsReview`, computed exactly like the element pipeline's: `name` is required, while a pending `description`/`uses` is stored as `null` and flags the molecule. `embed-molecules.py` reports the flagged count at the end of a run | Lets the hard data (SMILES, geometry, sources) land and be validated before the prose is written, without a sentinel string like "TODO" leaking into the UI. Reuses the "needsReview flag instead of silent nulls" decision already made for elements instead of inventing a second convention |
| 2026-07-18 | The molecule `type` vocabulary (`acid`, `sugar`, `base`, `lipid`, `hydrocarbon`, `amino-acid`, `alcohol`) lives in `src/constants/molecule-types.json`, read by both `molecules.ts` and the Python embedder, which rejects an unknown `type` at pipeline time. `molecules.json` stores only the English key; the user-visible label comes from the `moleculeTypes` block in `src/i18n/resources/{es,en}.json` | Same two-runtime problem as the bond table, solved the same way. Storing the key rather than the label keeps user-visible text in the i18n layer per the monorepo contract, and mirrors how an element stores `group: "transition-metal"`. Adding a category is then one JSON edit plus two translation lines; forgetting the translations surfaces as the Stage 3 "Traducción pendiente" placeholder rather than failing silently |
| 2026-07-18 | The bond-style/CPK table lives in `src/constants/bonds.json`, read by **both** runtimes: `bonds.ts` imports it (adding types and the `bondStyleFor`/`cpkColor` accessors, which is what `T-BOND-*` tests) and `scripts/bond_constants.py` loads the same file. **Supersedes the "mirrored by `embed-molecules.py`" decision above** | A hand-kept Python mirror could drift silently: the two runtimes never execute together, so nothing compares them. A stale mirror would leave `T-BOND-*` green while writing outdated `style`/`color` values into the committed `molecules.json`, breaking the viewer with no failing test. One shared JSON makes drift structurally impossible without a subprocess or codegen step; `*.config.json` is already a sanctioned constants location under the monorepo no-magic-values rule |
