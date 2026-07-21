/**
 * Initial-language resolution and persistence (Stage 3).
 *
 * Resolution rule (see spec i18n decisions + Gherkin): a stored preference
 * wins; otherwise Spanish is the default. The browser's language is
 * deliberately NOT consulted — first-time visitors always start in Spanish.
 */

import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from '../constants/i18n';

function isSupportedLanguage(value: string | null): value is Language {
  return value !== null && (LANGUAGES as readonly string[]).includes(value);
}

/** Read the persisted language, or null if absent/unsupported/unavailable. */
function readStoredLanguage(): Language | null {
  try {
    const stored = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    // localStorage can throw (private mode, disabled storage, SSR).
    return null;
  }
}

/** Resolve the language to use on load: stored preference, else Spanish. */
export function resolveInitialLanguage(): Language {
  return readStoredLanguage() ?? DEFAULT_LANGUAGE;
}

/** Persist the user's language choice for subsequent visits. */
export function persistLanguage(language: Language): void {
  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures — persistence is best-effort.
  }
}
