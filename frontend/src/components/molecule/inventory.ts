/**
 * Molecule inventory logic — the deterministic state and filtering behind the
 * list/info tabs. Pure functions so `T-MOL-*` can pin them down without the DOM
 * or Three.js.
 */

/** The inventory's two tabs. */
export type InventoryTab = 'list' | 'info';

export interface InventoryState {
  activeTab: InventoryTab;
  /** The selected molecule id, or null when nothing is selected. */
  selectedId: string | null;
}

/** No molecule selected by default; the List tab is shown first. */
export const INITIAL_INVENTORY: InventoryState = {
  activeTab: 'list',
  selectedId: null,
};

import { normalizeForSearch } from '../../utils/text';

/** Minimal shape the filter needs: a per-language display name. */
interface NamedMolecule {
  i18n: Record<string, { name?: string } | undefined>;
}

/**
 * Molecules whose localized name contains the query, case- and
 * accent-insensitively. An empty query returns the whole list.
 */
export function filterMolecules<T extends NamedMolecule>(
  molecules: readonly T[],
  query: string,
  language: string,
): T[] {
  const needle = normalizeForSearch(query);
  if (needle === '') return [...molecules];
  return molecules.filter((molecule) =>
    normalizeForSearch(molecule.i18n[language]?.name ?? '').includes(needle),
  );
}

/** Select a molecule: this reveals the Info tab (spec: selecting opens Info). */
export function selectMolecule(
  _state: InventoryState,
  id: string,
): InventoryState {
  return { activeTab: 'info', selectedId: id };
}

/** Switch tabs while preserving the current selection. */
export function showTab(state: InventoryState, tab: InventoryTab): InventoryState {
  return { ...state, activeTab: tab };
}
