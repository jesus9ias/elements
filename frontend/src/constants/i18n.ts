/**
 * i18n constants. Language codes, storage key, namespaces and the
 * missing-translation placeholder live here (no magic values inline).
 *
 * NOTE: the STORAGE key and PLACEHOLDER are declared now but only consumed in
 * Stage 3, when the tested i18n behaviors (initial-language resolution,
 * localStorage precedence, placeholder-on-missing) are implemented.
 */

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Spanish is the default language (monorepo decision). */
export const DEFAULT_LANGUAGE: Language = 'es';
export const FALLBACK_LANGUAGE: Language = 'es';

/** localStorage key that persists the user's language choice (Stage 3). */
export const LANGUAGE_STORAGE_KEY = 'elements.language';

/** Visible placeholder for a missing translation (Stage 3). */
export const MISSING_TRANSLATION_PLACEHOLDER = 'Traducción pendiente';

/** i18next namespaces: UI strings vs. language-agnostic shared values. */
export const I18N_NAMESPACES = {
  TRANSLATION: 'translation',
  COMMON: 'common',
} as const;
