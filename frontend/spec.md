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
├── design/                            # Claude Design handoff — the visual reference
│   ├── Guia Glassmorphism.dc.html     # authoritative source for the interface's look
│   └── README.md                      # handoff-bundle notes from the design tool
├── public/
│   └── fonts/                         # self-hosted Inter (woff2, weights 400–800)
├── scripts/
│   ├── fetch-elements.ts          # Wikidata + Wikipedia fetch, full-run or --element=<symbol>
│   ├── fetch-molecules.ts         # PubChem CID → Wikidata (P662) → Wikipedia extracts per lang
│   ├── summarize-molecules.ts     # Claude Haiku extraction of molecule description/uses
│   ├── fetch-isotopes.ts          # one-time seeding of curated/isotopes.json from Wikidata
│   ├── electron-configuration.ts  # expands Wikidata P8000 spectroscopic notation to per-shell counts
│   ├── summarize.ts               # Claude Haiku summarization step (raw → generated)
│   ├── merge.ts                   # generated + curated overrides → final elements.{lang}.json
│   ├── embed-molecules.py         # RDKit ETKDG + MMFF/UFF, bond classification, CPK colors
│   ├── check-contrast.py          # WCAG audit of the design tokens; run after any color change
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
  "discoveryDate": "-5000",
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
- Same manual drag/wheel orbit-and-zoom controller as the Molecule Visualizer's Viewer (see below), layered on top of the continuous electron animation — the user's rotation is independent of, and does not interrupt, the automatic orbit/spin motion.

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

## Visual Design System

`design/Guia Glassmorphism.dc.html` is the authoritative visual reference and must be consulted before any change to the interface's appearance. It is a Claude Design handoff, kept in-repo rather than in the design tool so the reference travels with the code.

The language it defines lives in `src/styles/tokens.css`, which remains the only place a color, blur, radius, shadow or type-scale value may be declared.

**Three glass tiers**, separated by blur depth and shadow reach so stacking order reads visually:

| Tier | Used by | Blur | Radius |
|---|---|---|---|
| `.glass--bar` | navbar | `--blur-bar` | `--radius-lg` |
| `.glass--panel` | molecule inventory, dictionary modal, 3D stage | `--blur-panel` | `--radius-lg` |
| `.glass--raised` | element detail | `--blur-raised` | `--radius-xl` |

Each tier is a vertical gradient between two translucent surface stops (never a flat fill), a hairline light border, an outer shadow and an `inset 0 1px 0` top highlight.

**Two control patterns**, reused rather than restyled per component:

- **Segmented switch** (`.segmented`) — navbar mode links, navbar language toggle, inventory List/Info tabs. Track at `--surface-track`; the active item is filled with the accent plus a 1px inset ring, never signalled by text color alone.
- **Glass control** (`.control`) — search inputs, secondary buttons, close buttons, prev/next navigation.

**Element category colors** stay exactly as the 2026-07-18 accessibility pass left them: ten base tokens, one per category. Every tint the interface needs — cell gradient, atomic number, name, mass, detail badge — is derived from that one token with `color-mix()`, so no tint can drift out of the audited state.

**Element cells** carry the symbol in near-pure white (not the category color) for maximum contrast, with the category color surviving in the border, the gradient fill and the secondary text. The hover-enlarge required above is retained; the guide's elevation and border glow are layered on top of it.

A cell is governed by two contrast criteria that pull against each other, and confusing them is the trap:

| | Measures | Threshold | Carried by |
|---|---|---|---|
| WCAG 1.4.3 | text vs the fill behind it | 4.5:1 | the **fill** density |
| WCAG 1.4.11 | the cell's edge vs the page | 3:1 | the **border**, ring and glow |

"Cells look dim / sink into the background" is a 1.4.11 complaint, and it is bought entirely from the border and the colored glow — neither of which sits behind text. The fill is capped at **20%**: above it the atomic number falls below AA over the brightest categories. Brightness requests are therefore answered at the edge, never by raising the fill.

Typography is Inter, self-hosted, with the system stack as its fallback.

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
| 2026-07-22 | Bohr-model view gets the same manual drag/wheel orbit-and-zoom controller as the Molecule Visualizer's Viewer | Developer request for interaction parity between the two 3D views; reuses the existing controller instead of inventing a second one |
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
| 2026-07-21 | A visual-refinement pass applies `design/Guia Glassmorphism.dc.html` (a Claude Design handoff) across the whole interface, and that file is kept in-repo as the standing visual reference for any future appearance change | The design was authored outside the codebase; storing only the resulting CSS would lose the intent (the before/after rationale for each block). Keeping the handoff next to the code means a later change can be checked against what was actually designed, not reverse-engineered from tokens |
| 2026-07-21 | The guide's hover treatment for element cells (`translateY(-2px)` lift) does **not** replace the spec's hover-enlarge; the cell still scales, and the guide's elevation and border glow are layered on top | "Hovering a cell enlarges/overlaps it for quick readability" is a stated requirement with its own 2026-07-17 Decisions Log row, and a 2px lift does not deliver the readability the requirement exists for. The guide's shadow/glow is additive, so both survive |
| 2026-07-21 | The ten `--category-*-soft` tokens are removed. Every category tint is derived from the single `--category-*` base with `color-mix()` | The guide replaces the flat category fill with a gradient plus three differentiated text tints, which one static `-soft` value cannot express. Adding four more tokens per category would mean 50 hand-maintained values that could drift out of the 2026-07-18 audited state independently; deriving them keeps exactly one authoritative value per category |
| 2026-07-21 | Inter is self-hosted in `public/fonts/` rather than linked from Google Fonts as the guide's mock does | The app is offline-first by design — all content is bundled and nothing is fetched at runtime (see the "no runtime loading states" decision). A webfont CDN would be the single runtime network dependency in the whole app, and a third-party one at that |
| 2026-07-21 | **Accessibility — the guide's element-cell values could not be used as drawn.** Measured against the real compositing stack, the guide's 22% category fill drops a pure-white symbol to 4.42:1 on the light categories (transition-metal yellow, halogen cyan) where the page glow is strongest, and its category-tinted number/name/mass run 2.7–4.4:1. Text tinted the same hue as the surface beneath it is inherently low-contrast: mixing toward the category color only clears AA past ~92% white. Resolved by lowering the cell fill to 18% (badge 20%, cap is ~20% before the white symbol fails) and pinning the three tints just above the AA floor at 85/80/75% white, with size and weight carrying the hierarchy instead of color. Worst case is now 4.83:1; everything else has margin | The 2026-07-18 pass committed this interface to WCAG AA across all ten categories, and a design mock is not evidence about contrast — it was drawn over one background, while the real cells sit over a gradient with two colored glows. The guide's *intent* (white symbol, category in the border and fill, mass as a corner value) survives intact; only the numeric values moved |
| 2026-07-21 | The contrast audit is committed as `scripts/check-contrast.py`, reads `tokens.css` directly, and exits non-zero on any AA failure | The 2026-07-18 audit was run programmatically but never committed, so this pass had to rediscover from scratch that the palette was AA-clean and rebuild the compositing model. Reading the stylesheet rather than a copy of the values means the audit cannot silently drift from what ships. It stays a local developer tool, like every other script here — CI/CD never runs it |
| 2026-07-21 | **Guide update — brighter element cells.** The guide was revised to ask for a 40%/16% category fill, a 0.75 lightened border, a colored outer glow plus a 1px colored ring, a stronger inset highlight, and lifted name/mass text. Everything was adopted EXCEPT the fill, which went 18%→20% rather than 40%: 40% measures 2.95:1 on the atomic number, and 20% is the ceiling under the audit's conservative reading (21% already gives 4.48:1). The stated goal — cells that read as lit instead of sunk into the background — is met in full by the edge treatment: the cell's non-text contrast went from 3.54:1 to 6.09:1 worst-case | The two criteria at play are different and pull opposite ways. WCAG 1.4.11 (a component's boundary vs its surroundings, 3:1) is what "sinking into the background" measures, and it is carried by the border, ring and glow — none of which sit behind text. WCAG 1.4.3 (4.5:1) is what the fill degrades. Buying the brightness at the edge instead of the fill satisfies the design intent and improves BOTH numbers, where raising the fill would have traded one for the other |
| 2026-07-21 | `scripts/check-contrast.py` gained a WCAG 1.4.11 section for the cell edge, and the cell tint/fill/border/glow values are all tokens rather than a single `--cell-shadow` literal | The script previously measured only text contrast, so it could not have answered "are the cells bright enough against the page" — the exact question the guide update raised. A criterion that is not measured is a criterion that drifts. Splitting elevation into ring/glow/highlight tokens is what let the guide's treatment be adopted piecewise instead of all-or-nothing |
| 2026-07-22 | `vite.build.cssMinify` is pinned to `'esbuild'` in `astro.config.mjs`, overriding Vite 8's `'lightningcss'` default | Reported in production only: element-cell glow (a legitimate, pre-existing paint that spills slightly past the 0.3rem grid gap, always masked by each cell's own `backdrop-filter` blur) was showing through unmasked at cell borders. Root cause was that lightningcss's minifier treats `backdrop-filter` and `-webkit-backdrop-filter` as one logical property and silently keeps only whichever is declared last, dropping the other — verified directly against the `lightningcss` package. Every glass surface (`.element-cell`, `.glass--bar/panel/raised`) declares both, so prod builds lost the standard property while `astro dev` (unminified) kept it. `esbuild`'s CSS minifier preserves both declarations, verified by rebuilding and diffing `dist/_astro/*.css`. Scoped to `build.cssMinify` only — `css.transformer` stays on `postcss`, so `color-mix()`/nesting handling is unaffected |
| 2026-07-21 | Navbar styles were written from scratch in this pass, not refined | `Navbar.tsx` emitted `.navbar`, `.navbar__brand`, `.navbar__modes` and `.navbar__languages` since Stage 1, but no rule for any of them existed anywhere in `src/` — the component rendered with only the generic `.glass` surface. Recorded so the gap is not mistaken for a regression introduced here |
| 2026-07-22 | `.molecule-stage`'s mobile media query uses `height: 20rem`, not `min-height: 20rem` | Reported: the 3D molecule scene stayed blank on a mobile-width first load, but rendered correctly after resizing to desktop and back. Root cause, confirmed with direct DOM measurement: `.molecule-viewer` (the Three.js container) is `height: 100%`, and a flex container's height only counts as "definite" for a percentage-height child when it comes from `height` (or, on desktop, `aspect-ratio`) — never from `min-height` alone. With only `min-height` on mobile, `.molecule-viewer`'s `height: 100%` fell back to auto/content sizing; its only content is the canvas, whose own height `scene-lifecycle.ts`'s `mountScene` sets from this same container's `clientHeight` at mount — before the canvas exists, that reads 0, so the two settled into a self-reinforcing 0/1px deadlock that only a later real resize (which recomputes the desktop `aspect-ratio`-derived definite height first) could break |
| 2026-07-22 | `.element-cell` moved from 4 stacked rows (number / symbol / name / mass) to 3, with mass sharing the top row next to the atomic number (`grid-template-areas`); `.periodic-table-mode[data-detail-open]` additionally trims the number/name/mass font sizes a notch | Reported: the atomic mass disappeared when the detail sidebar was open, since the grid shrinks to fit. Measured directly (not assumed): with the sidebar open, `--content-max-width: 1200px` minus the 23rem detail column always drives every cell down to the grid's `--cell-min` floor (2.5rem/40px) — this is the normal sidebar-open state at any typical viewport, not a rare narrow-window edge case. At that floor, the old 4-row layout demanded more height than the cell had, and CSS Grid's track-sizing crushed the name and mass rows to ~2.4px — functionally invisible. Moving mass to the number's row removes one row entirely, which alone gets mass and number to their full natural height. The remaining shortfall lands entirely on the name row (the symbol row won't shrink below its glyph's content-min, so grid takes the deficit from name instead); trimming all three text sizes together when the sidebar is open — verified empirically against the actual 40px floor, not calculated — removes that shortfall rather than shrinking only the one row grid happens to squeeze | **Superseded same day, see next row** — number+mass sharing a row at the 40px floor turned out to have a *width* problem the font-size fix didn't touch: for elements with a 3-digit number and a long mass (e.g. Xe "54"/"131.293"), the two collided horizontally, since number's `1fr` column has no truncation and simply overflows into mass's `auto` column when the row is too narrow |
| 2026-07-22 | **Supersedes the row above.** `--cell-min` raised from `2.5rem` to `3.75rem`; the `[data-detail-open]` font-size overrides are removed entirely. The three-row `.element-cell` layout (mass beside the atomic number) is kept as a permanent visual choice, not a size workaround | Developer's own follow-up proposal: the original 4-row layout was never broken at a normal, uncompressed cell size — only `--cell-min` (2.5rem) was too small to hold it, on both mobile and sidebar-open desktop alike. Rather than keep shrinking cell content to survive an undersized cell, raise the floor so cells never get that small anywhere, and let the grid's existing `overflow-x: auto` scroll instead — exactly the pattern already accepted for mobile in the 2026-07-17 "no hover-enlarge equivalent... horizontal scroll" decision. 3.75rem was chosen by scanning the actual widest number+mass pairing across all 118 elements (not guessed): at 3.5rem the worst case (Fermio, "100"/"257.095") still touched with a sub-pixel negative gap; at 3.75rem every element clears by ≥3px and the name row renders at its full, uncompressed height everywhere. `--cell-min` is defined once in `.periodic-table-mode`, so mobile and the sidebar-open desktop grid share the identical floor and behavior by construction, per the developer's explicit request |
| 2026-07-22 | `.periodic-table-mode[data-detail-open]`'s grid column is `minmax(0, 1fr)`, not bare `1fr`; `.periodic-table-mode[data-detail-open] .periodic-grid` additionally gets `min-width: 0`, overriding the base `.periodic-grid { min-width: min-content }` | Reported, with a screenshot: the detail sidebar rendered outside the space under the navbar, and the whole page scrolled instead of just the table. Root cause, confirmed by measuring the actual rendered boxes: raising `--cell-min` to 3.75rem (row above) made `.periodic-grid`'s min-content wide enough that, combined with the `--cell-hover-bleed` padding also applied to it, a bare `1fr` track's implicit `auto` minimum forced the two-column grid (`1fr` + the fixed 23rem sidebar) to a combined width far exceeding `main`'s 1200px cap. Since `.periodic-table-mode[data-detail-open]` is deliberately `overflow-x: visible` (only `.periodic-grid` itself should scroll), that excess was never clipped — it physically pushed the sidebar column past the page's right edge. The same mechanism was already present at the old 2.5rem floor (~33px of overflow, imperceptible), so this was a latent bug the `--cell-min` increase made dramatically worse, not a new one. `minmax(0, 1fr)` lets the column actually shrink to the space available instead of forcing the layout wider; `.periodic-grid`'s own `min-width: min-content` then had to be overridden to `0` in this context too, or the grid item would still render at full content width and visually spill across the sidebar column even with a correctly-sized track. Verified by measuring `.element-detail`'s rect (now inside `main`'s bounds) and `.periodic-grid`'s own `scrollWidth`/`clientWidth` (now genuinely different, confirming the grid — not the page — is what scrolls) |
| 2026-07-22 | Navbar (`Navbar.tsx`/`navbar.css`) collapses to icon-only below `40rem`: the two mode links and the Diccionario trigger swap their text label for a small SVG (hand-authored inline, no icon library — matches the project's existing zero-dependency icon precedent, `element-detail__close` and `HelpIcon`'s plain `×`/`?` glyphs) or the same `?` glyph respectively, keeping the accessible name via `aria-label`/`title` on the control itself rather than the visible content. The old mobile rule that forced `.navbar__start`/`.navbar__actions` to `width: 100%` (stacking the bar into 2-3 rows) is removed; the bar now stays one row at every width | Developer request: minimize the periodic table's vertical scroll on mobile by shrinking the navbar's footprint. Measured before/after on a 375×812 viewport: the navbar went from 3 stacked rows (brand, then mode tabs, then language+dictionary) to a single 64px row, and the periodic grid — all 10 row-tracks, 7 periods plus the f-block spacer rows — now fits inside the viewport height with no vertical scroll at all, only the already-expected horizontal scroll for columns. Desktop (`min-width: 40rem`) is unchanged: icons stay in the DOM (`display: none`) rather than being conditionally rendered, so there's no hydration/layout difference to verify across the breakpoint, only a CSS toggle |
| 2026-07-23 | **Corrects the row above.** The claim "elements known since antiquity have no P575 claim at all" is factually wrong — Wikidata has a BCE P575 claim for at least Fe, Au (both `-XXXX-01-01T00:00:00Z`). Confirmed directly against `data/raw/{en,es}/{Fe,Au}.json`: the fetch captures the claim faithfully; `discoveryYear`'s regexes are anchored (`^(\d{1,4})-\d{2}-\d{2}`) so a leading `-` correctly fails to match, and the BCE claim becomes `null` — same as before this row, and correct as a parsing matter | Reported by the developer while reviewing Fe's missing discoverer/date. Superseded same day, see below: the developer decided BCE years should render as era text after all, so `null` is no longer the final answer for this case |
| 2026-07-23 | `discoverer` now runs through `resolveDiscoverer()` (`merge.ts`), which nulls any value starting with `WIKIDATA_GENID_PREFIX` (`src/constants/pipeline.ts`) | Reported: Fe's `discoverer` held a literal blank-node IRI (`http://www.wikidata.org/.well-known/genid/…`) instead of `null`. Root cause confirmed in the raw fetch, not the merge step: Wikidata's P61 (discoverer or inventor) is itself set to "unknown value" for Fe, Au and Zn, and the label service resolves an unknown value to the blank node's own skolemized IRI since there is nothing to label — faithful to what Wikidata returns, not a fetch bug. `discoveryYear` already had an equivalent guard for the parallel case on `discoveryDate`; `discoverer` had none and passed the IRI straight through. Same fix shape, same three elements affected (`grep -rl "well-known/genid" data/raw` before the fix) |
| 2026-07-23 | **Supersedes the 2026-07-18 "BCE dates and unparseable values become `null`" decision, for BCE specifically.** `discoveryYear` (`merge.ts`) now keeps a BCE year as a negative number (e.g. `"-5000"` for Fe) instead of discarding it to `null`. `formatDiscoveryYear` (`format.ts`) renders it via a new i18n key, `periodicTable.discoveryBce` ("{{year}} antes de nuestra era" / "{{year}} BCE"), only used for negative values; a genuinely absent year still falls through to `UNKNOWN_DASH`. Verified in-browser: Fe reads "5000 antes de nuestra era" (es), Au reads "6000 BCE" (en) | Developer's explicit decision, reversing the earlier "never synthesized by the pipeline" stance for this specific case. The split still holds the original principle intact: `merge.ts` only ever emits a signed integer (language-agnostic), never era text — the "antes de nuestra era"/"BCE" string itself is written once, in `es.json`/`en.json`, same as every other user-visible string in the app. Unparseable/genuinely-missing values (e.g. Zn, whose own P575 is a Wikidata "unknown value" genid, not a BCE date) are unaffected and still render as `—` |
| 2026-07-23 | New curated-override marker `CONFIRMED_ABSENT` (`src/constants/pipeline.ts`, value `"$confirmed-absent"`): a field held at this marker in `data/curated/overrides/{lang}/{symbol}.json` is excluded from `needsReview` by `isMissing()`, then downgraded to real `null` by `resolveConfirmedAbsent()` before the record is written — the marker never reaches `elements.{lang}.json` or the UI. Applied to Fe's `discoverer` (`data/curated/overrides/{en,es}/Fe.json`) | Developer flagged that Fe's `discoverer` had previously been hand-marked `needsReview: false` directly in the generated config — an edit that cannot survive a re-run, since `merge.ts` recomputes `needsReview` from `data/raw/`+overrides on every invocation and never reads the prior generated output. The real gap: there was no *source* location to record "checked, this is genuinely unknowable" (elements known since prehistoric antiquity have no individual to credit; Wikidata's own P61 statement is an explicit "unknown value", not merely absent) versus "not yet looked at". `CONFIRMED_ABSENT` is that location — a curated, per-field, per-element assertion, not a change to `REQUIRED_ELEMENT_FIELDS` (which would have silenced the check for every element, including ones that genuinely need research). Verified: `needsReview` is `false` for Fe post-merge, the shipped value is still real `null` (renders as `—`, unchanged), and a clean re-run reproduces byte-identical output (idempotency check). Same day, extended to Au/Ag/Cu on developer confirmation — identical situation, same Wikidata "unknown value" P61 for each. All four verified: `needsReview: false`, `discoverer: null` (not the marker — `grep -r "confirmed-absent" src/config/ data/generated/` is empty), idempotent re-run, in-browser check on Fe and Cu shows no review badge with `DISCOVERER` still `—` |
| 2026-07-27 | **Refines the 2026-07-23 `CONFIRMED_ABSENT` row for Zn, and supersedes that day's "Zn … still renders as `—`" note.** Zn's `discoveryDate`/`discoverer` are filled by curated override with the isolation credit — `"1746"` / `"Andreas Sigismund Marggraf"` (en), `"1746"` / `"Andreas Marggraf"` (es) — rather than being marked `CONFIRMED_ABSENT` like Fe/Au/Ag/Cu. The name is spelled as each language's own Wikipedia article writes it, since both are extractions from the article already in `data/raw/{lang}/Zn.json` | Developer's decision while reviewing the `needsReview` set: unlike iron or copper, zinc was **not** identified as a distinct metal in antiquity — the ancient artifacts are brass alloys, and both source articles say the ancients did not understand the metal's nature — so "known since prehistory, nobody to credit" does not apply here and `CONFIRMED_ABSENT` would assert the wrong thing. Both source articles do credit an isolator in the same year: en, "Andreas Sigismund Marggraf is credited with discovering pure metallic zinc in 1746"; es, his work "cimentó… su reputación como descubridor del metal". Zn was the only element whose *both* discovery fields came back as Wikidata "unknown value" genids (P575 **and** P61), which is why it survived the 2026-07-23 pass — that pass only covered `discoverer`. **The 1000 BCE reading was considered and rejected**: `es.wikipedia` dates brass pieces to 1500–1000 BCE in Canaan, which fixes an alloy, not the element, so writing it into `discoveryDate` would assert something no source states. Note the fetch could not have seen such a date anyway — the query uses `wdt:P575`, which never returns qualifiers on an unknown-value node; reading one would need `p:P575/pq:…` and a re-fetch. Verified: full merge (never `--element`, which rewrites the config with that element alone), diff touches Zn only in both languages, `needsReview: false`, re-run byte-identical, 21/21 tests pass. Sn/Sb/Hg/Pb/Bi remain flagged and are a separate case — their P575/P61 are simply absent, not "unknown value" |
