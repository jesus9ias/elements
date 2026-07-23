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

**A flex/grid child's `height: 100%` needs an explicit `height` on the parent — `min-height` does not count.** Per CSS, a percentage height only resolves against a containing block whose height is "definite" (an explicit `height`, or `aspect-ratio` given a definite width); a size that only comes from `min-height` doesn't qualify, and the percentage falls back to `auto` (content-based) sizing. `.molecule-stage` on mobile set `min-height: 20rem` with no `height`, so `.molecule-viewer` (`height: 100%`, the Three.js mount container) sized itself to its own content instead — and its only content is the canvas, whose height `mountScene` sets from this same container's `clientHeight` at mount. Before the canvas exists that reads 0, so canvas and container locked into a self-reinforcing 0/1px loop that persisted until an unrelated resize recomputed the desktop `aspect-ratio` version first. Fixed by using `height: 20rem` instead of `min-height` in the mobile media query. Diagnose this class of bug with `getComputedStyle`/`clientHeight` on the actual container chain, not by reading the CSS and assuming percentages "just work."

**When a definite-size CSS Grid container can't fit its `auto` rows, the deficit is not distributed proportionally.** A row backed by an `fr` track with real content (e.g. the element-cell symbol) keeps its full content-min size; the shortfall instead lands entirely on whichever plain `auto` row is left with no competing minimum — verified by watching row heights in `getComputedStyle(cell).gridTemplateRows` while changing one row's font-size at a time, not by reasoning about the spec. This is how the element-cell's atomic mass first went fully invisible (crushed to ~2px) at the grid's old `--cell-min` floor of 2.5rem, while the symbol stayed full size. Two fixes were tried in sequence, and the first one only traded the bug for a different one: (1) giving mass its own row-sharing slot next to the atomic number removed a row and fixed the height crush, but at 2.5rem a 3-digit number plus a long mass (e.g. Xe "54"/"131.293") then overflowed *horizontally* into each other, since the number's `1fr` column has no truncation; (2) the real fix was to stop shrinking cell content to survive an undersized cell at all — `--cell-min` was raised to 3.75rem (checked against the actual widest number+mass pair across all 118 elements, not guessed) so cells never get small enough for either problem, and the grid's existing `overflow-x: auto` scrolls instead. `--cell-min` lives once in `.periodic-table-mode`, so mobile and the sidebar-open desktop grid share the same floor by construction — verify any future cell-content change by scanning all 118 `.element-cell`s for the worst-case gap/height, not a couple of hand-picked elements.

**A bare `1fr` grid track has an implicit `auto` (content-based) minimum — it does not just shrink to fit.** `fr` alone means `minmax(auto, 1fr)`; if a `1fr` column's content (or, via `min-width`, a *child's* content) has a large min-content width, the track is forced to at least that size even when there isn't room, growing the whole grid past its container instead of letting the flexible column shrink. This is exactly what happened when `--cell-min` went to 3.75rem: `.periodic-table-mode[data-detail-open] { grid-template-columns: 1fr var(--detail-width) }` forced the two-column layout wider than `main` (1200px), and because that container is deliberately `overflow-x: visible` (only `.periodic-grid` should scroll, not the page), the excess wasn't clipped — it physically pushed the sidebar off the right edge of the page. Fixed by `minmax(0, 1fr)` (an explicit 0 minimum overrides the implicit content-based one) *and*, separately, overriding `.periodic-grid`'s own `min-width: min-content` to `0` in that same context — the track being correctly sized isn't enough if the grid item inside it still refuses to shrink below its own content. Diagnose by comparing `getComputedStyle(gridContainer).gridTemplateColumns` (the actual resolved track sizes) against the container's own rendered width, and checking whether the overflowing child's `scrollWidth` differs from its `clientWidth` (it should, once the fix lets it actually get clipped) — not by eyeballing a screenshot.

**Headless browsers throttle `requestAnimationFrame`.** Screenshots of the Three.js scenes time out and frame counters read zero — an artifact of the automation context, not the code. The 3D visuals are the developer's manual validation by design.

## Architecture notes

**Astro islands are separate React roots.** They cannot share state. The Dictionary modal is mounted once by `BaseLayout`; the navbar button and every `?` icon reach it through the window `CustomEvent` declared in `src/constants/dictionary.ts`.

**Three.js is lazy-loaded.** `BohrModel` and `MoleculeViewer` are behind `React.lazy`, so the ~525 kB Three chunk loads only when a detail view or the viewer opens — never in the initial grid bundle. Vite dedupes it into one shared chunk. `chunkSizeWarningLimit` is raised to 600 in `astro.config.mjs` to acknowledge that one chunk; do not raise it further to silence a real regression.

**No icon library — icons are hand-authored inline, either plain glyphs or small inline SVG.** `element-detail__close` and `HelpIcon` use a bare `×`/`?` character; the navbar's mobile mode icons (`Navbar.tsx`) use small hand-written inline `<svg>` with `stroke="currentColor"`/`fill="currentColor"` so they inherit the surrounding text color automatically. Keep following this pattern — it's zero-dependency and offline-first by construction, matching the rest of the app; don't reach for an icon font or component library for the next one.

**Every 3D scene goes through `src/three/scene-lifecycle.ts`.** It owns setup, the render loop and — critically — full GPU disposal. The dispose-on-navigation criterion is verified by there being exactly one `<canvas>` after navigating across several elements or molecules.

## Data conventions

- `needsReview: true` marks a record with a genuinely missing required field. It is the designed visible-gap mechanism, **not** an error — do not "fix" it by inventing values or by relaxing the required-field list. The one sanctioned escape hatch is `CONFIRMED_ABSENT` (`src/constants/pipeline.ts`): a curated override can hold this marker instead of `null` to assert "checked, genuinely absent" rather than "not yet looked at" (e.g. Fe/Au/Ag/Cu's `discoverer`, where Wikidata's own P61 statement is an explicit "unknown value"). `merge.ts` excludes a field holding it from `needsReview`, then writes real `null` in its place — the marker never reaches the shipped config or the UI, and the value shown to the user is unchanged (`—`, same as any other missing field). Adding this marker to an element is a curated, per-field assertion — it is not a way to relax the required-field list globally.
- Missing values are `null`. Never a sentinel string like `"TODO"`, which would render literally.
- `discoveryDate` holds a year parsed from Wikidata P575, as a signed integer string (BCE stored negative, e.g. `"-5000"`); genuinely unparseable/absent values become `null`. The script only ever emits a number — era text ("antes de nuestra era" / "BCE") is language-dependent and lives in i18n (`periodicTable.discoveryBce`), rendered by `formatDiscoveryYear` (`format.ts`), never synthesized by the script itself.
- Prose is **extracted, never generated**. The summarizer prompts forbid adding model knowledge and require `null` when the source text doesn't cover a field.
- Molecule Wikipedia articles resolve mechanically: verified PubChem CID → Wikidata P662 → sitelinks. Two molecules whose CIDs are specific stereoisomers (`glucose`, `fructose`) pin their articles via an explicit `wikipedia` field in `molecules.source.json`.
