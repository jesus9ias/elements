/**
 * Navbar (Stage 3: language switch now functional + persistent).
 *
 * Mode links navigate between routes. The language buttons persist the choice
 * and switch i18next live. On mount, the stored preference is applied (the
 * instance is initialized with the default language for an SSR-safe first
 * render, so this effect avoids a hydration mismatch). The Dictionary trigger
 * remains a stub until Stage 7.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import './navbar.css';
import '../i18n/config';
import { resolveInitialLanguage, persistLanguage } from '../i18n/language';
import { LANGUAGES, I18N_NAMESPACES, type Language } from '../constants/i18n';
import { APP_MODES, ROUTES, type AppMode } from '../constants/routes';
import { openDictionary } from '../constants/dictionary';

interface NavbarProps {
  /** Current pathname, provided by the Astro layout for active-mode styling. */
  currentPath: string;
}

const MODE_LABEL_KEY: Record<AppMode, string> = {
  [APP_MODES.PERIODIC_TABLE]: 'modes.periodicTable',
  [APP_MODES.MOLECULES]: 'modes.molecules',
};

export default function Navbar({ currentPath }: NavbarProps) {
  const { t, i18n } = useTranslation();

  // Apply the stored preference once on the client, after hydration.
  useEffect(() => {
    const initial = resolveInitialLanguage();
    if (i18n.language !== initial) {
      void i18n.changeLanguage(initial);
    }
    document.documentElement.lang = initial;
  }, [i18n]);

  const handleSelectLanguage = (language: Language): void => {
    persistLanguage(language);
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  };

  // The modal is its own island; islands talk via the shared window event.
  const handleOpenDictionary = (): void => openDictionary();

  return (
    <nav className="navbar glass glass--bar" aria-label={t('common:brand')}>
      <div className="navbar__start">
        <span className="navbar__brand">
          {t('common:brand', { ns: I18N_NAMESPACES.COMMON })}
        </span>

        <ul className="navbar__modes segmented">
          {(Object.values(APP_MODES) as AppMode[]).map((mode) => {
            const href = ROUTES[mode];
            const isActive = currentPath === href;
            return (
              <li key={mode}>
                <a
                  className="segmented__item"
                  href={href}
                  data-active={isActive || undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {t(MODE_LABEL_KEY[mode])}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="navbar__actions">
        <div
          className="navbar__languages segmented"
          role="group"
          aria-label={t('nav.language')}
        >
          {LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              className="segmented__item navbar__language"
              data-active={i18n.language === language || undefined}
              aria-pressed={i18n.language === language}
              onClick={() => handleSelectLanguage(language)}
            >
              {t(`common:languageLabels.${language}`, { ns: I18N_NAMESPACES.COMMON })}
            </button>
          ))}
        </div>

        <button type="button" className="control" onClick={handleOpenDictionary}>
          {t('nav.dictionary')}
        </button>
      </div>
    </nav>
  );
}
