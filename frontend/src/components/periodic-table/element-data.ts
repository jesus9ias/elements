/**
 * Element content loader for the periodic table.
 *
 * The merged pipeline output is imported directly (not fetched): it is
 * precomputed and committed, so the app has no runtime loading/error states for
 * content (spec decision). Each language file already carries the full record,
 * so the right one is selected by the active UI language.
 */

import type { ElementRecord } from '../../constants/elements';
import type { Language } from '../../constants/i18n';
import elementsEs from '../../config/elements.es.json';
import elementsEn from '../../config/elements.en.json';

type ElementMap = Record<string, ElementRecord>;

const BY_LANGUAGE: Record<Language, ElementMap> = {
  es: elementsEs as unknown as ElementMap,
  en: elementsEn as unknown as ElementMap,
};

/** All elements for a language, ordered by atomic number. */
export function elementsFor(language: Language): ElementRecord[] {
  return Object.values(BY_LANGUAGE[language]).sort(
    (a, b) => a.atomicNumber - b.atomicNumber,
  );
}

/** A single element by atomic number, or undefined if out of range. */
export function elementByNumber(
  language: Language,
  atomicNumber: number,
): ElementRecord | undefined {
  return BY_LANGUAGE[language][String(atomicNumber)];
}
