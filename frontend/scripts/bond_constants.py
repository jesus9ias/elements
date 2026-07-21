"""Python reader for `src/constants/bonds.json`.

`bonds.json` is the SINGLE SOURCE OF TRUTH for bond styling and atom coloring,
shared verbatim with `src/constants/bonds.ts`. This module only loads it and
adds the one thing the TypeScript side has no use for: the mapping from RDKit's
own bond types onto that shared vocabulary.

Nothing here restates a style name or a color. Edit `bonds.json` instead.
"""

import json

from rdkit import Chem

import embed_constants as config

with config.BONDS_JSON_PATH.open(encoding=config.JSON_READ_ENCODING) as _handle:
    _BONDS = json.load(_handle)

BOND_STYLES = {order: entry["style"] for order, entry in _BONDS["bondStyles"].items()}
CPK_COLORS = _BONDS["cpkColors"]
CPK_DEFAULT_COLOR = _BONDS["cpkDefaultColor"]

# RDKit bond type -> the shared bond-order vocabulary. Anything absent from this
# map is not representable in the MVP (ionic, dative, unspecified) and the
# embedder fails loudly on it.
RDKIT_BOND_ORDERS = {
    Chem.BondType.SINGLE: "single",
    Chem.BondType.DOUBLE: "double",
    Chem.BondType.TRIPLE: "triple",
    Chem.BondType.AROMATIC: "aromatic",
}

# Import-time guard: this map is the one place a bond-order name is still
# spelled out on the Python side, so assert it against the shared table rather
# than discovering the mismatch as a KeyError mid-run.
_unknown_orders = set(RDKIT_BOND_ORDERS.values()) - set(BOND_STYLES)
if _unknown_orders:
    raise RuntimeError(
        f"RDKIT_BOND_ORDERS references bond order(s) absent from "
        f"{config.BONDS_JSON_PATH.name}: {', '.join(sorted(_unknown_orders))}. "
        "Both must use the same vocabulary."
    )


def bond_style_for(order: str) -> str:
    """Resolve a bond order to its visual style. Raises loudly on unknown input."""
    if order not in BOND_STYLES:
        raise KeyError(
            f'Unknown bond order "{order}". '
            f"Expected one of: {', '.join(BOND_STYLES)}."
        )
    return BOND_STYLES[order]


def cpk_color(element: str) -> str:
    """Color for an atom's element symbol, per the CPK convention."""
    return CPK_COLORS.get(element, CPK_DEFAULT_COLOR)
