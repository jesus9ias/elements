"""Tuning and path constants for `embed-molecules.py`.

Kept out of the script itself per the monorepo no-magic-values rule.
"""

import json
from pathlib import Path

# Repository paths, resolved relative to this file (scripts/ lives in frontend/).
FRONTEND_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = FRONTEND_ROOT / "data" / "curated" / "molecules.source.json"
OUTPUT_PATH = FRONTEND_ROOT / "src" / "config" / "molecules.json"

# The bond-style/CPK table, shared verbatim with `src/constants/bonds.ts`.
BONDS_JSON_PATH = FRONTEND_ROOT / "src" / "constants" / "bonds.json"

# The molecule `type` vocabulary, shared with `src/constants/molecules.ts`.
MOLECULE_TYPES_JSON_PATH = FRONTEND_ROOT / "src" / "constants" / "molecule-types.json"

# Extracted prose from summarize-molecules.ts, and the raw fetch it came from
# (the latter carries the Wikipedia URL used for attribution). Both are optional:
# without them the pipeline still runs and the text stays null + needsReview.
GENERATED_DIR = FRONTEND_ROOT / "data" / "generated"
RAW_DIR = FRONTEND_ROOT / "data" / "raw"


def generated_molecules_path(language: str) -> Path:
    return GENERATED_DIR / f"molecules.{language}.json"


def raw_molecules_path(language: str) -> Path:
    return RAW_DIR / f"molecules.{language}.json"


# Attribution label for the article a molecule's prose was extracted from.
WIKIPEDIA_SOURCE_LABEL = "Wikipedia"

# Fixed seed so a re-run of an unchanged source file produces an identical
# conformer. Without it ETKDG is stochastic and every run would churn the
# committed JSON with meaningless coordinate diffs.
EMBED_RANDOM_SEED = 0xE1E3

# ETKDG occasionally fails to converge on the first try for strained rings;
# retrying with a different seed offset is the documented remedy.
EMBED_MAX_ATTEMPTS = 5

# RDKit's sentinel for "embedding failed".
EMBED_FAILURE_CODE = -1

# Force-field optimization iteration budget per molecule.
OPTIMIZE_MAX_ITERATIONS = 2000

# Decimal places kept for atom coordinates. Angstrom-scale geometry needs no
# more precision than this, and rounding keeps the committed JSON diff-stable.
COORDINATE_PRECISION = 4

# Required keys every entry in molecules.source.json must define.
REQUIRED_MOLECULE_FIELDS = ("id", "smiles", "type", "i18n", "sources")

# Languages every molecule must provide text for.
REQUIRED_MOLECULE_LANGUAGES = ("es", "en")

# `name` is hard data — a molecule without one is an error.
REQUIRED_MOLECULE_TEXT_FIELDS = ("name",)

# Prose written by hand after the geometry lands. Missing values are stored as
# null and flag the molecule with needsReview, rather than a sentinel string
# that would render literally in the UI.
PENDING_MOLECULE_TEXT_FIELDS = ("description", "uses")

# JSON formatting for the committed output.
JSON_INDENT = 2

# Reads use utf-8-sig so a byte-order mark survives contact with the pipeline:
# both bonds.json and molecules.source.json are hand-edited, and Windows editors
# (Notepad, PowerShell's Set-Content) prepend a BOM that plain utf-8 rejects.
# Vite/TypeScript tolerate it, so without this the Python side would be the only
# one to break. Writes stay plain utf-8 — we never emit a BOM ourselves.
JSON_READ_ENCODING = "utf-8-sig"
JSON_WRITE_ENCODING = "utf-8"

# Loaded last, since it depends on the encoding constants above. Shared verbatim
# with molecules.ts — the embedder rejects any `type` outside this vocabulary, so
# a typo fails at pipeline time instead of surfacing as a broken label in the UI.
with MOLECULE_TYPES_JSON_PATH.open(encoding=JSON_READ_ENCODING) as _handle:
    MOLECULE_TYPES = tuple(json.load(_handle)["moleculeTypes"])
