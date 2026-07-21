"""embed-molecules.py — precompute 3D conformers for the MVP molecule set.

Local developer tool, run on-demand. NEVER part of the CI/CD build.

Reads the hand-maintained `data/curated/molecules.source.json`, and for each
molecule runs RDKit `AddHs` -> `EmbedMolecule` (ETKDGv3) -> MMFF (falling back
to UFF) optimization, then extracts atom coordinates, classifies every bond and applies CPK colors,
and writes `src/config/molecules.json`.

Bond styles and CPK colors come from `src/constants/bonds.json` via
`bond_constants.py` — the same file `src/constants/bonds.ts` reads, so the
pipeline and the viewer can never disagree.

Failure policy (see the spec's "Content pipeline integrity" scenario): every
molecule is processed first and ALL errors are collected. If any molecule
fails, the script reports each offending id and exits non-zero WITHOUT touching
the output file — no partial or broken data ever reaches molecules.json.

Usage (from `frontend/`):
    .venv/Scripts/python.exe scripts/embed-molecules.py
    .venv/Scripts/python.exe scripts/embed-molecules.py --molecule=glucose
"""

from __future__ import annotations

import argparse
import json
import sys

from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, rdMolDescriptors

import embed_constants as config
from bond_constants import RDKIT_BOND_ORDERS, bond_style_for, cpk_color


class MoleculeError(Exception):
    """A single molecule failed validation or embedding, by id."""

    def __init__(self, molecule_id: str, reason: str) -> None:
        super().__init__(reason)
        self.molecule_id = molecule_id
        self.reason = reason


def parse_cli_args(argv: list[str]) -> argparse.Namespace:
    """`--molecule=<id>` scopes the run to one molecule; default is all."""
    parser = argparse.ArgumentParser(
        description="Precompute 3D conformers for the curated molecule set.",
    )
    parser.add_argument(
        "--molecule",
        default=None,
        help="Embed only the molecule with this id (default: all).",
    )
    return parser.parse_args(argv)


def load_optional_map(path) -> dict:
    """Read a JSON object keyed by molecule id, or {} when the file is absent."""
    if not path.exists():
        return {}
    with path.open(encoding=config.JSON_READ_ENCODING) as handle:
        return json.load(handle)


def load_generated() -> tuple[dict, dict]:
    """Extracted prose and raw fetch records, per language, keyed by molecule id."""
    generated = {
        language: load_optional_map(config.generated_molecules_path(language))
        for language in config.REQUIRED_MOLECULE_LANGUAGES
    }
    raw = {
        language: load_optional_map(config.raw_molecules_path(language))
        for language in config.REQUIRED_MOLECULE_LANGUAGES
    }
    return generated, raw


def load_source() -> list[dict]:
    """Read molecules.source.json, failing loudly if it is missing or malformed."""
    if not config.SOURCE_PATH.exists():
        raise SystemExit(f"Source file not found: {config.SOURCE_PATH}")

    with config.SOURCE_PATH.open(encoding=config.JSON_READ_ENCODING) as handle:
        try:
            source = json.load(handle)
        except json.JSONDecodeError as error:
            raise SystemExit(f"{config.SOURCE_PATH} is not valid JSON: {error}") from error

    if not isinstance(source, list):
        raise SystemExit(f"{config.SOURCE_PATH} must contain a JSON array of molecules.")
    return source


def validate_entry(entry: dict, index: int) -> None:
    """Structural validation of one source entry, before RDKit sees it."""
    molecule_id = entry.get("id") or f"<entry #{index}>"

    missing = [field for field in config.REQUIRED_MOLECULE_FIELDS if not entry.get(field)]
    if missing:
        raise MoleculeError(molecule_id, f"missing required field(s): {', '.join(missing)}")

    molecule_type = entry["type"]
    if molecule_type not in config.MOLECULE_TYPES:
        raise MoleculeError(
            molecule_id,
            f'unknown type "{molecule_type}". Expected one of: '
            f"{', '.join(config.MOLECULE_TYPES)}. "
            f"Add the category to {config.MOLECULE_TYPES_JSON_PATH.name} "
            "(plus its es/en label) if it is genuinely new.",
        )

    i18n = entry["i18n"]
    if not isinstance(i18n, dict):
        raise MoleculeError(molecule_id, '"i18n" must be an object keyed by language')

    for language in config.REQUIRED_MOLECULE_LANGUAGES:
        block = i18n.get(language)
        if not isinstance(block, dict):
            raise MoleculeError(molecule_id, f'missing "i18n.{language}" block')
        missing_text = [
            field for field in config.REQUIRED_MOLECULE_TEXT_FIELDS if not block.get(field)
        ]
        if missing_text:
            raise MoleculeError(
                molecule_id, f'"i18n.{language}" missing: {", ".join(missing_text)}'
            )

        unknown = set(block) - set(config.REQUIRED_MOLECULE_TEXT_FIELDS) - set(
            config.PENDING_MOLECULE_TEXT_FIELDS
        )
        if unknown:
            raise MoleculeError(
                molecule_id,
                f'"i18n.{language}" has unexpected field(s): {", ".join(sorted(unknown))}',
            )


def resolve_text(entry: dict, generated: dict, language: str) -> dict:
    """
    Merge one language's molecule text FIELD BY FIELD: hand-curated text in
    molecules.source.json wins, extracted text fills the gaps, and anything
    still missing stays an explicit null (which flags needsReview).
    """
    curated = entry["i18n"].get(language, {})
    extracted = generated.get(language, {}).get(entry["id"], {})

    resolved = {"name": curated["name"]}
    for field in config.PENDING_MOLECULE_TEXT_FIELDS:
        resolved[field] = curated.get(field) or extracted.get(field) or None
    return resolved


def wikipedia_sources(entry: dict, raw: dict) -> list[dict]:
    """
    Attribution for the articles the prose was extracted from. Wikipedia is
    CC BY-SA, so derived text must link back to its article.
    """
    sources = []
    for language in config.REQUIRED_MOLECULE_LANGUAGES:
        url = raw.get(language, {}).get(entry["id"], {}).get("wikipediaUrl")
        if url:
            sources.append(
                {"label": f"{config.WIKIPEDIA_SOURCE_LABEL} ({language})", "url": url}
            )
    return sources


def build_conformer(molecule_id: str, smiles: str) -> Chem.Mol:
    """Parse, hydrogenate, embed and optimize one molecule in 3D."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise MoleculeError(molecule_id, f"RDKit could not parse SMILES: {smiles!r}")

    mol = Chem.AddHs(mol)

    # ETKDG is stochastic; a fixed seed keeps committed output reproducible, and
    # retries with a shifted seed cover the strained-ring convergence failures.
    for attempt in range(config.EMBED_MAX_ATTEMPTS):
        params = AllChem.ETKDGv3()
        params.randomSeed = config.EMBED_RANDOM_SEED + attempt
        if AllChem.EmbedMolecule(mol, params) != config.EMBED_FAILURE_CODE:
            break
    else:
        raise MoleculeError(
            molecule_id,
            f"ETKDG failed to embed after {config.EMBED_MAX_ATTEMPTS} attempts: {smiles!r}",
        )

    # MMFF is the better force field but is not parameterized for every element;
    # UFF covers the whole periodic table and is the documented fallback.
    if AllChem.MMFFHasAllMoleculeParams(mol):
        AllChem.MMFFOptimizeMolecule(mol, maxIters=config.OPTIMIZE_MAX_ITERATIONS)
    else:
        AllChem.UFFOptimizeMolecule(mol, maxIters=config.OPTIMIZE_MAX_ITERATIONS)

    return mol


def extract_atoms(mol: Chem.Mol) -> list[dict]:
    """Atom symbols, 3D coordinates and CPK colors, in RDKit atom-index order."""
    conformer = mol.GetConformer()
    atoms = []
    for atom in mol.GetAtoms():
        position = conformer.GetAtomPosition(atom.GetIdx())
        element = atom.GetSymbol()
        atoms.append(
            {
                "element": element,
                "x": round(position.x, config.COORDINATE_PRECISION),
                "y": round(position.y, config.COORDINATE_PRECISION),
                "z": round(position.z, config.COORDINATE_PRECISION),
                "color": cpk_color(element),
            }
        )
    return atoms


def extract_bonds(molecule_id: str, mol: Chem.Mol) -> list[dict]:
    """Bond connectivity with order and resolved visual style."""
    bonds = []
    for bond in mol.GetBonds():
        bond_type = bond.GetBondType()
        order = RDKIT_BOND_ORDERS.get(bond_type)
        if order is None:
            raise MoleculeError(
                molecule_id,
                f"unsupported bond type {bond_type} between atoms "
                f"{bond.GetBeginAtomIdx()} and {bond.GetEndAtomIdx()} "
                "(ionic and dative bonds are out of scope for the MVP)",
            )
        bonds.append(
            {
                "from": bond.GetBeginAtomIdx(),
                "to": bond.GetEndAtomIdx(),
                "order": order,
                "style": bond_style_for(order),
            }
        )
    return bonds


def embed_molecule(entry: dict, index: int, generated: dict, raw: dict) -> dict:
    """Turn one source entry into its final molecules.json record."""
    validate_entry(entry, index)

    molecule_id = entry["id"]
    mol = build_conformer(molecule_id, entry["smiles"])

    # The formula is derived, never hand-maintained. When the source declares
    # one it acts as an assertion against typos in the SMILES string.
    formula = rdMolDescriptors.CalcMolFormula(mol)
    declared = entry.get("formula")
    if declared and declared != formula:
        raise MoleculeError(
            molecule_id,
            f"declared formula {declared!r} does not match the SMILES, "
            f"which yields {formula!r}",
        )

    # Curated text wins per field; extracted text fills the gaps; whatever is
    # still missing stays an explicit null rather than an absent key.
    i18n = {
        language: resolve_text(entry, generated, language)
        for language in config.REQUIRED_MOLECULE_LANGUAGES
    }
    needs_review = any(
        not i18n[language][field]
        for language in config.REQUIRED_MOLECULE_LANGUAGES
        for field in config.PENDING_MOLECULE_TEXT_FIELDS
    )

    return {
        "id": molecule_id,
        "formula": formula,
        "smiles": entry["smiles"],
        "type": entry["type"],
        "isomers": entry.get("isomers", []),
        "atoms": extract_atoms(mol),
        "bonds": extract_bonds(molecule_id, mol),
        "i18n": i18n,
        "sources": entry["sources"] + wikipedia_sources(entry, raw),
        "needsReview": needs_review,
    }


def main(argv: list[str]) -> int:
    # RDKit logs sanitization warnings to stderr; our own error report is the
    # contract with the developer, so keep the output readable.
    RDLogger.DisableLog("rdApp.*")

    args = parse_cli_args(argv)
    source = load_source()
    generated, raw = load_generated()

    seen_ids: set[str] = set()
    errors: list[MoleculeError] = []
    molecules: list[dict] = []

    for index, entry in enumerate(source):
        if not isinstance(entry, dict):
            errors.append(MoleculeError(f"<entry #{index}>", "entry is not an object"))
            continue

        molecule_id = entry.get("id")
        if molecule_id in seen_ids:
            errors.append(MoleculeError(str(molecule_id), "duplicate molecule id"))
            continue
        if molecule_id:
            seen_ids.add(molecule_id)

        if args.molecule and molecule_id != args.molecule:
            continue

        try:
            molecules.append(embed_molecule(entry, index, generated, raw))
        except MoleculeError as error:
            errors.append(error)

    if errors:
        print(f"\nEmbedding FAILED for {len(errors)} molecule(s):\n", file=sys.stderr)
        for error in errors:
            print(f"  - {error.molecule_id}: {error.reason}", file=sys.stderr)
        print(
            f"\n{config.OUTPUT_PATH.name} was NOT written. "
            "Fix the source entries above and re-run.",
            file=sys.stderr,
        )
        return 1

    if args.molecule and not molecules:
        print(f"No molecule with id {args.molecule!r} in {config.SOURCE_PATH.name}.", file=sys.stderr)
        return 1

    # A scoped run must not drop the molecules it didn't touch: merge the fresh
    # record into the existing output instead of overwriting the whole file.
    if args.molecule and config.OUTPUT_PATH.exists():
        with config.OUTPUT_PATH.open(encoding=config.JSON_READ_ENCODING) as handle:
            existing = json.load(handle)
        by_id = {molecule["id"]: molecule for molecule in existing}
        by_id[args.molecule] = molecules[0]
        molecules = [
            by_id[entry["id"]] for entry in source if entry.get("id") in by_id
        ]

    config.OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with config.OUTPUT_PATH.open("w", encoding=config.JSON_WRITE_ENCODING) as handle:
        json.dump(molecules, handle, indent=config.JSON_INDENT, ensure_ascii=False)
        handle.write("\n")

    atom_count = sum(len(molecule["atoms"]) for molecule in molecules)
    print(
        f"Embedded {len(molecules)} molecule(s), {atom_count} atoms total "
        f"-> {config.OUTPUT_PATH.relative_to(config.FRONTEND_ROOT)}"
    )

    flagged = [molecule["id"] for molecule in molecules if molecule["needsReview"]]
    if flagged:
        print(
            f"\n{len(flagged)} molecule(s) flagged needsReview - "
            f"pending {'/'.join(config.PENDING_MOLECULE_TEXT_FIELDS)}:"
        )
        for molecule_id in flagged:
            print(f"  - {molecule_id}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
