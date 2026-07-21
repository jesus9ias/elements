/**
 * Bond styling and atom coloring — typed accessors over `bonds.json`.
 *
 * The values themselves live in `bonds.json`, which is the single source of
 * truth read by BOTH runtimes: this module (consumed by the Stage 6 viewer and
 * pinned by `T-BOND-*`) and `scripts/bond_constants.py` (the content pipeline,
 * which writes the resolved `style`/`color` into `src/config/molecules.json`).
 *
 * A hand-kept copy on either side could drift silently, since the two runtimes
 * never execute together — see the 2026-07-18 Decisions Log entry. Add or change
 * values in `bonds.json`, never here.
 */

import bondsData from './bonds.json';

/** Visual style names, as stored in `molecules.json`. */
export const BOND_STYLE_NAMES = bondsData.bondStyleNames;

export interface BondStyle {
  /** Style name, as stored in `molecules.json`. */
  style: string;
  /** How many cylinders the viewer draws between the two atoms. */
  cylinders: number;
  /** When true, one of the cylinders is rendered dashed (delocalization). */
  dashed?: boolean;
}

/**
 * Bond order → visual style. Aromatic is deliberately NOT expanded to Kekulé:
 * it renders one solid + one dashed cylinder to represent delocalization.
 */
export const BOND_STYLES = bondsData.bondStyles as Record<string, BondStyle>;

/** SMILES bond orders the pipeline can classify. */
export type BondOrder = keyof typeof bondsData.bondStyles;

export const BOND_ORDERS = Object.keys(BOND_STYLES) as readonly BondOrder[];

/** Resolve a bond order to its visual style. Throws loudly on unknown input. */
export function bondStyleFor(order: BondOrder): BondStyle {
  const style = BOND_STYLES[order];
  if (!style) {
    throw new Error(
      `Unknown bond order "${order}". Expected one of: ${BOND_ORDERS.join(', ')}.`,
    );
  }
  return style;
}

/**
 * Standard CPK atom colors. Covers the elements present in the MVP molecule
 * set plus common inorganics; anything else falls back to CPK_DEFAULT_COLOR.
 */
export const CPK_COLORS = bondsData.cpkColors as Record<string, string>;

/** CPK convention for "unrecognized element". */
export const CPK_DEFAULT_COLOR = bondsData.cpkDefaultColor;

/** Color for an atom's element symbol, per the CPK convention. */
export function cpkColor(element: string): string {
  return CPK_COLORS[element] ?? CPK_DEFAULT_COLOR;
}
