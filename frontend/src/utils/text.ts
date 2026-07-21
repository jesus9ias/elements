/**
 * Shared text helpers for search inputs.
 *
 * Both the molecule inventory and the dictionary filter accent-insensitively,
 * so the normalization lives here rather than being restated in each.
 */

/**
 * Lowercase and strip diacritics, so "acido" matches "Ácido" and "smi"
 * matches "SMILES". Uses NFD decomposition to separate combining marks.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
