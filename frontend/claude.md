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
