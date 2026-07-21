/**
 * Dictionary logic — alphabetical ordering and the filter behind the modal.
 * Pure functions so `T-DICT-*` can pin them down without the DOM.
 */

import { normalizeForSearch } from '../../utils/text';

/** A dictionary entry, as stored in `data/dictionary/terms.{lang}.json`. */
export interface DictionaryTerm {
  term: string;
  definition: string;
}

/**
 * Terms in alphabetical order.
 *
 * Uses `localeCompare`, NOT `<`: the Spanish list starts several entries with
 * "Á" (Átomo, Ácido, Ángstrom) and a naive code-point sort pushes those past
 * "Z". `T-DICT-01`'s fixture happens to use only ASCII initials, so a broken
 * sort would still pass it while the real list rendered wrong.
 */
export function sortTerms<T extends { term: string }>(
  terms: readonly T[],
  language?: string,
): T[] {
  return [...terms].sort((a, b) => a.term.localeCompare(b.term, language));
}

/**
 * Terms whose name contains the query, case- and accent-insensitively.
 * An empty query returns everything. Matches on the term only, so a query
 * narrows to the entries a reader is actually looking for.
 */
export function filterTerms<T extends { term: string }>(
  terms: readonly T[],
  query: string,
): T[] {
  const needle = normalizeForSearch(query);
  if (needle === '') return [...terms];
  return terms.filter((entry) => normalizeForSearch(entry.term).includes(needle));
}
