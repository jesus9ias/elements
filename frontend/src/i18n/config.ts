/**
 * i18next initialization (Stage 3).
 *
 * Wires i18next + react-i18next with the `translation` (per-language) and
 * `common` (language-agnostic) namespaces, and implements the T-I18N behaviors:
 *   - `fallbackLng: false` — a key missing in the active language does NOT
 *     silently fall back to another language...
 *   - ...instead `parseMissingKeyHandler` surfaces a visible placeholder
 *     ("Traducción pendiente"), so missing translations are obvious.
 *
 * The instance is initialized with the DEFAULT language for a deterministic,
 * SSR-safe first render; the stored preference is applied on the client after
 * mount (see `resolveInitialLanguage` usage in the navbar) to avoid hydration
 * mismatches.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './resources/common.json';
import es from './resources/es.json';
import en from './resources/en.json';
import {
  DEFAULT_LANGUAGE,
  I18N_NAMESPACES,
  MISSING_TRANSLATION_PLACEHOLDER,
} from '../constants/i18n';

if (!i18n.isInitialized) {
  // `void`: init returns a promise, but with inline resources it resolves
  // synchronously and react-i18next reads from the ready instance.
  void i18n.use(initReactI18next).init({
    resources: {
      es: { [I18N_NAMESPACES.TRANSLATION]: es, [I18N_NAMESPACES.COMMON]: common },
      en: { [I18N_NAMESPACES.TRANSLATION]: en, [I18N_NAMESPACES.COMMON]: common },
    },
    lng: DEFAULT_LANGUAGE,
    // No silent fallback: missing translations must be visible, not masked.
    fallbackLng: false,
    ns: [I18N_NAMESPACES.TRANSLATION, I18N_NAMESPACES.COMMON],
    defaultNS: I18N_NAMESPACES.TRANSLATION,
    interpolation: { escapeValue: false },
    parseMissingKeyHandler: () => MISSING_TRANSLATION_PLACEHOLDER,
    react: { useSuspense: false },
  });
}

export default i18n;
