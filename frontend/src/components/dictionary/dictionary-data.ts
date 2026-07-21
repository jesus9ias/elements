/**
 * Dictionary content loader. The term lists are 100% hand-curated (no script)
 * and imported like the rest of the content — precomputed, no runtime fetch.
 */

import type { DictionaryTerm } from './dictionary';
import termsEs from '../../../data/dictionary/terms.es.json';
import termsEn from '../../../data/dictionary/terms.en.json';

const BY_LANGUAGE: Record<string, DictionaryTerm[]> = {
  es: termsEs as DictionaryTerm[],
  en: termsEn as DictionaryTerm[],
};

/** All terms for a language (unsorted; the modal sorts for display). */
export function termsFor(language: string): DictionaryTerm[] {
  return BY_LANGUAGE[language] ?? [];
}
