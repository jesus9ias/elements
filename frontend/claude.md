# Frontend — working notes for Claude Code

Inherits the root [`claude.md`](../claude.md). This file is the accumulated operational knowledge: conventions that are load-bearing, and traps that have already cost time.

---

## Single sources of truth

Two tables are read by **both** the TypeScript app and the Python pipeline. They live in JSON precisely so neither runtime holds a copy:

| File | Read by |
|---|---|
| `src/constants/bonds.json` | `src/constants/bonds.ts` (typed accessors, `T-BOND-*`) **and** `scripts/bond_constants.py` |
| `src/constants/molecule-types.json` | `src/constants/molecules.ts` **and** `scripts/embed_constants.py` |

**Never restate these values in a consumer.** An earlier hand-kept Python mirror was replaced for a concrete reason: the two runtimes never execute together, so a stale mirror would keep `T-BOND-*` green while writing outdated styles into committed data — a failure with no failing test.

Element category membership (`src/constants/categories.ts`) is likewise the pipeline's source for `group`; it throws at load time if any of the 118 is uncategorized or duplicated.

`src/styles/tokens.css` is the third: every color, blur, radius, shadow and type-scale value in the interface. A component stylesheet may declare geometry local to its own layout (grid tracks, aspect ratios) and nothing else.

## Design changes start in `design/`

`design/Guia Glassmorphism.dc.html` is the Claude Design handoff that defines the interface's look — glass tiers, the segmented-switch and glass-control patterns, the element-cell treatment. **Read it before any change that affects appearance**, and prefer extending its vocabulary over inventing a parallel one.

Two things it does NOT govern, both deliberate:

- **Category colors.** The guide's swatches are generic hue demos (`oklch(… 250)`, `oklch(… 30)`). The real palette is the ten `--category-*` tokens, which passed the 2026-07-18 accessibility audit — do not replace them with values read off the guide. Every tint is derived from that one base per category with `color-mix()`; there is no second value to keep in sync, and that is the point.
- **Cell hover.** The guide proposes a 2px lift; `spec.md` requires an enlarge. The enlarge wins, with the guide's glow layered on. See the 2026-07-21 Decisions Log rows.

Fixed pixel sizes in the guide are proportions, not measurements — its 84 px cells cannot fit 18 columns inside `--content-max-width`.

**Run `python scripts/check-contrast.py` after touching any color, fill or tint token.** It reads `tokens.css` and exits non-zero below threshold. This is not ceremony: the guide's element-cell values have failed twice — its original 22% fill puts a white symbol at 4.42:1 over the light categories, and its "brighter cells" update asks for 40%, which measures 2.95:1. Nothing about the rendered result looks wrong enough to catch by eye, and the failures concentrate on `transition-metal` and `halogen` (the brightest categories, over the warm background glow), so spot-checking hydrogen or iron proves nothing.

**"The cells look dim" is never fixed by raising `--cell-fill-top`.** Two criteria pull against each other on a cell:

- **1.4.3** (4.5:1) — text vs the fill behind it. Degrades as the fill brightens. The fill is capped at **20%**; 21% already puts the atomic number at 4.48:1.
- **1.4.11** (3:1) — the cell's edge vs the page. This is what "sinking into the background" actually measures, and it is carried by `--cell-border-alpha`, `--cell-border-tint` and the ring/glow tokens — *none of which sit behind text*.

Answer brightness requests at the edge. Raising the border from 0.50 to 0.75 took the worst-case edge from 3.54:1 to 6.09:1 and cost the text nothing; raising the fill would have traded one criterion for the other.

## Traps

**Run tests from `frontend/` with `npm test`.** `npx vitest` from the repo root picks up a config-less cached vitest without jsdom.

**Validate with `astro build` + `astro preview`, not `astro dev`.** Astro 7's dev daemon can serve broken hydration.

**`scripts/` is not covered by `astro check`** — `tsconfig.json` includes `src` only. Pipeline scripts are type-checked only when Node runs them.

**Pipeline output belongs in `src/`, never `public/`.** Vite treats `public/` as served-as-is assets: importing from there warns *and* duplicates the payload (once copied to the build, once inlined in JS). This was corrected once already.

**Sorting user-visible lists needs `localeCompare`, never `<`.** The Spanish dictionary has three entries starting with "Á"; a code-point sort puts them after "Z". `T-DICT-01`'s fixture is ASCII-only, so a broken sort passes the test and breaks the UI.

**Filenames that differ only in case collide on Windows.** `Inventory.tsx` next to `inventory.ts` broke the build; the component is `InventoryPanel.tsx` for that reason. Do not rename it back.

**Python reads JSON with `utf-8-sig`.** Windows editors prepend a BOM that Vite tolerates and plain `utf-8` rejects — without this, the Python side would be the only one to break. Writes stay plain `utf-8`.

**Wikidata quantity properties will not match `VALUES` integer literals.** P1086 is stored as `xsd:decimal`; `VALUES ?z { 33 }` matches nothing. Use `FILTER(?z IN (…))`, which coerces numerically. A diagnostic probe returned zero rows for exactly this reason.

**Prefer few `OPTIONAL`s per SPARQL query.** Wikidata returns the cross product of their values; six optionals pushed P8000 out of the result for 54 elements, surfacing as silently empty data rather than an error. Split single-purpose queries instead.

**`node --experimental-strip-types -e "import('./x.ts')"` hangs.** Write a temporary `.ts` file inside the project and run it directly. Note that raw Node ESM needs explicit `.ts` extensions, while `src/` modules use extensionless imports that only Vite/Vitest resolve.

**`overflow-x: auto` clips the vertical axis too.** Per CSS Overflow, when one axis is not `visible` the other cannot stay `visible` — it computes to `auto`. So the periodic grid's horizontal scroll container also clips vertically, and a hover-enlarged cell silently loses whatever grows past the grid's edge (measured: 14 px off the top and left of the corner cell). The fix is `--cell-hover-bleed` — padding inside the scroll container plus a matching negative margin — applied to *whichever element is scrolling*, which differs depending on whether the detail sidebar is open. Verify with `getComputedStyle(el).overflowY`, not with what the stylesheet says.

**Production CSS can silently differ from what `astro dev` serves.** Vite 8 (pulled in by `@astrojs/react`) defaults `build.cssMinify` to `lightningcss`, whose minifier treats `backdrop-filter` and `-webkit-backdrop-filter` as one logical property and keeps only whichever is declared last — dropping the other from every rule that declares both (`.element-cell`, `.glass--bar/panel/raised`). `astro dev` never minifies, so this only ever showed up in `astro build` output, surfacing as unmasked box-shadow glow bleeding across the periodic-table cell borders in production. Fixed by pinning `cssMinify: 'esbuild'` in `astro.config.mjs` (esbuild preserves both declarations); `css.transformer` is untouched. This is exactly why the "validate with `astro build` + `astro preview`" rule above exists — verify by diffing `dist/_astro/*.css`, not by reading source.

**Headless browsers throttle `requestAnimationFrame`.** Screenshots of the Three.js scenes time out and frame counters read zero — an artifact of the automation context, not the code. The 3D visuals are the developer's manual validation by design.

## Architecture notes

**Astro islands are separate React roots.** They cannot share state. The Dictionary modal is mounted once by `BaseLayout`; the navbar button and every `?` icon reach it through the window `CustomEvent` declared in `src/constants/dictionary.ts`.

**Three.js is lazy-loaded.** `BohrModel` and `MoleculeViewer` are behind `React.lazy`, so the ~525 kB Three chunk loads only when a detail view or the viewer opens — never in the initial grid bundle. Vite dedupes it into one shared chunk. `chunkSizeWarningLimit` is raised to 600 in `astro.config.mjs` to acknowledge that one chunk; do not raise it further to silence a real regression.

**Every 3D scene goes through `src/three/scene-lifecycle.ts`.** It owns setup, the render loop and — critically — full GPU disposal. The dispose-on-navigation criterion is verified by there being exactly one `<canvas>` after navigating across several elements or molecules.

## Data conventions

- `needsReview: true` marks a record with a genuinely missing required field. It is the designed visible-gap mechanism, **not** an error — do not "fix" it by inventing values or by relaxing the required-field list.
- Missing values are `null`. Never a sentinel string like `"TODO"`, which would render literally.
- `discoveryDate` holds a year parsed from Wikidata P575. BCE dates and unparseable values become `null`; era text ("Antigüedad") is language-dependent and belongs in i18n or an override, never synthesized by a script.
- Prose is **extracted, never generated**. The summarizer prompts forbid adding model knowledge and require `null` when the source text doesn't cover a field.
- Molecule Wikipedia articles resolve mechanically: verified PubChem CID → Wikidata P662 → sitelinks. Two molecules whose CIDs are specific stereoisomers (`glucose`, `fructose`) pin their articles via an explicit `wikipedia` field in `molecules.source.json`.
