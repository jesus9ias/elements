/**
 * Molecule content loader. Like the element data, `molecules.json` is imported
 * (bundled) rather than fetched — precomputed and committed, no runtime loading.
 */

import type { MoleculeRecord } from '../../constants/molecules';
import molecules from '../../config/molecules.json';

const ALL = molecules as unknown as MoleculeRecord[];

/** All molecules, alphabetically by their name in the given language. */
export function moleculesSortedByName(language: string): MoleculeRecord[] {
  return [...ALL].sort((a, b) =>
    (a.i18n[language]?.name ?? '').localeCompare(b.i18n[language]?.name ?? '', language),
  );
}

/** A single molecule by id. */
export function moleculeById(id: string): MoleculeRecord | undefined {
  return ALL.find((molecule) => molecule.id === id);
}
