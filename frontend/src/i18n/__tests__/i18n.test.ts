import { describe, it, expect, beforeEach } from 'vitest';

import {
  LANGUAGE_STORAGE_KEY,
  MISSING_TRANSLATION_PLACEHOLDER,
  I18N_NAMESPACES,
} from '../../constants/i18n';
// Implemented in Stage 3 — does not exist yet, so this suite is RED.
import { resolveInitialLanguage } from '../language';
import i18n from '../config';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T-I18N-01: defaults to Spanish when no stored preference exists', () => {
    expect(resolveInitialLanguage()).toBe('es');
  });

  it('T-I18N-02: a stored preference takes precedence over browser language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    expect(resolveInitialLanguage()).toBe('en');
  });

  it('T-I18N-03: a field missing in the current language shows the placeholder, not a silent fallback', async () => {
    // Present only in Spanish; must NOT silently fall back to it when viewing English.
    i18n.addResource('es', I18N_NAMESPACES.TRANSLATION, 'esOnlyField', 'Solo en español');
    await i18n.changeLanguage('en');

    expect(i18n.t('esOnlyField')).toBe(MISSING_TRANSLATION_PLACEHOLDER);
  });
});
