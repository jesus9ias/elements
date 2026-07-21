# Attribution & Licensing

Elements is an educational project built on openly licensed data. This is the general
notice; the specific origin of each element and molecule is linked from its own
`sources` array in the published JSON, which doubles as the "learn more" link in the UI.

## Data sources

### Wikidata — CC0 1.0 (public domain dedication)

Structured facts for the 118 elements (atomic mass, melting and boiling points,
discovery date and discoverer, half-life, known isotopes, electron configuration)
come from [Wikidata](https://www.wikidata.org) via its SPARQL endpoint.

Wikidata content is released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), which places it in the
public domain. No attribution is legally required; we provide it anyway, both as good
practice and because the per-entity links are useful to readers.

### Wikipedia — CC BY-SA 4.0

The free-text fields (`description`, `uses`, `characteristics`) are derived from the
opening sections of the corresponding Wikipedia articles, fetched separately in Spanish
and English — never machine-translated from one into the other.

Wikipedia text is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This license requires
attribution and carries a share-alike obligation, so:

- Every element links to the specific Wikipedia article it was derived from, per language.
- Any redistribution of those derived text fields must remain under CC BY-SA 4.0.

### PubChem — public domain

Molecule identifiers, canonical SMILES strings and reference data come from
[PubChem](https://pubchem.ncbi.nlm.nih.gov/), maintained by the U.S. National Library of
Medicine. PubChem's own records are in the public domain; individual depositor-contributed
entries may carry their own terms. Each molecule links to its PubChem CID.

## Generated content

### AI-assisted text extraction

The `description`, `uses` and `characteristics` fields are produced by an
**extraction-only** summarization pass (Claude Haiku) over the Wikipedia text above. The
prompt forbids inventing content and returns `null` when a field is not present in the
source, so these fields remain derivative works of the CC BY-SA Wikipedia articles rather
than independently authored text — the share-alike obligation applies to them.

Fields that could not be extracted are left `null` and the record is flagged
`needsReview`, so gaps are visible rather than silently filled.

### 3D molecular geometry

Atom coordinates in `molecules.json` are **not** taken from any external database. They
are computed locally from each molecule's SMILES string using
[RDKit](https://www.rdkit.org/) (ETKDG conformer generation followed by MMFF or UFF
force-field optimization). RDKit is licensed under the
[BSD 3-Clause License](https://github.com/rdkit/rdkit/blob/master/license.txt).

These conformers are a physically plausible low-energy geometry, generated for
visualization. They are not experimental structures and should not be cited as such.

### Electron configurations

Electron configurations come from Wikidata's P8000 claim where present. Wikidata lacks
that claim for 54 of the 118 elements; for those, the configuration is taken from a
curated reference table of standard ground-state configurations
(`data/curated/electron-configurations.json`), never computed from a simplified rule.
Predicted configurations for the superheaviest elements are theoretical and flagged as
pending verification in that file.

### Atom colors

Atoms are colored using the standard CPK convention, a long-established scientific
visualization convention rather than a licensed asset.

## Dictionary

The dictionary terms in `data/dictionary/terms.{es,en}.json` are written by hand for this
project. No text is copied from the sources above.

## Bundled assets

### Inter — SIL Open Font License 1.1

The interface is set in [Inter](https://rsms.me/inter/) by Rasmus Andersson, shipped as a
variable font in `frontend/public/fonts/` rather than loaded from a font CDN, so the app
makes no third-party requests at runtime.

Inter is licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/). The license permits bundling
and redistribution, including in a commercial product, and requires that the license
travel with the font files — `frontend/public/fonts/OFL.txt` is that copy. The font is
distributed unmodified and is not sold on its own.

## Scope of this notice

This file covers **content, data and bundled assets**. Licenses for the software
dependencies used to build and run the site (Astro, React, Three.js, i18next and their
transitive dependencies) are carried in their own packages and are not restated here.
