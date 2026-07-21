/**
 * Molecule data model constants shared by the content pipeline and the UI.
 *
 * The `type` vocabulary itself lives in `molecule-types.json`, the single
 * source of truth read by this module and by `scripts/embed_constants.py`.
 * Add a category there, never here — see the 2026-07-18 Decisions Log entry.
 */

import type { BondOrder } from './bonds.ts';
import moleculeTypesData from './molecule-types.json';

/** Allowed values for a molecule's `type` field, as stored in `molecules.json`. */
export const MOLECULE_TYPES: readonly string[] = moleculeTypesData.moleculeTypes;

/**
 * A molecule's category key.
 *
 * Deliberately `string` and not a literal union: the vocabulary is imported
 * from JSON, which TypeScript infers as `string[]`, so no union is available
 * at compile time. The guarantee is enforced at runtime instead — the embedder
 * rejects an unknown `type` before it can reach `molecules.json`, which is the
 * only place a bad value could originate. The alias is kept for readability in
 * signatures.
 */
export type MoleculeType = string;

/** Whether a value belongs to the molecule type vocabulary. */
export function isMoleculeType(value: string): boolean {
  return MOLECULE_TYPES.includes(value);
}

/** i18n namespace holding the user-visible label for each molecule type. */
export const MOLECULE_TYPE_LABEL_PREFIX = 'moleculeTypes';

/** Translation key for a molecule type's display label. */
export function moleculeTypeLabelKey(type: MoleculeType): string {
  return `${MOLECULE_TYPE_LABEL_PREFIX}.${type}`;
}

/** One atom of a precomputed conformer, in Angstroms. */
export interface MoleculeAtom {
  element: string;
  x: number;
  y: number;
  z: number;
  /** Resolved CPK color, written by the pipeline from `bonds.json`. */
  color: string;
}

/** One bond, indexing into the molecule's `atoms` array. */
export interface MoleculeBond {
  from: number;
  to: number;
  order: BondOrder;
  /** Resolved visual style, written by the pipeline from `bonds.json`. */
  style: string;
}

/**
 * Per-language molecule text. `name` is hard data and always present;
 * `description`/`uses` are null while the prose is still pending, which flags
 * the molecule with `needsReview`.
 */
export interface MoleculeText {
  name: string;
  description: string | null;
  uses: string | null;
}

/** A source attribution entry (doubles as the "learn more" link). */
export interface MoleculeSource {
  label: string;
  url: string;
}

/** A molecule record as consumed by the app, language-agnostic core + i18n. */
export interface MoleculeRecord {
  id: string;
  /** Derived by RDKit from the SMILES, never hand-maintained. */
  formula: string;
  smiles: string;
  type: MoleculeType;
  isomers: string[];
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  i18n: Record<string, MoleculeText>;
  sources: MoleculeSource[];
  /** True while any language is still missing `description`/`uses`. */
  needsReview: boolean;
}
