/**
 * Dictionary constants (Stage 7).
 *
 * The modal lives in its own Astro island (mounted once by the layout), while
 * its triggers — the navbar button and every contextual "?" icon — live in
 * OTHER islands. Astro islands are separate React roots and cannot share state
 * directly, so they communicate through a window CustomEvent.
 */

/** Event that asks the dictionary modal to open. */
export const DICTIONARY_OPEN_EVENT = 'elements:dictionary-open';

/** Optional payload: the term to pre-filter to (contextual "?" deep-link). */
export interface DictionaryOpenDetail {
  term?: string;
}

/** Dispatch helper so triggers never hand-roll the event name. */
export function openDictionary(term?: string): void {
  window.dispatchEvent(
    new CustomEvent<DictionaryOpenDetail>(DICTIONARY_OPEN_EVENT, {
      detail: term ? { term } : {},
    }),
  );
}
