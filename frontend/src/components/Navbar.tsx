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

/**
 * A small grid of cells, echoing the element-cell grid itself — reads as
 * "the periodic table" at a glance without a text label.
 */
function PeriodicTableIcon() {
  return (
    <svg
      className="navbar__mode-icon"
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7.5" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="7.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7.5" y="7.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="7.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** A central atom bonded to three others — the molecule viewer's glyph. */
function MoleculeIcon() {
  return (
    <svg
      className="navbar__mode-icon"
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <line x1="10" y1="10" x2="4" y2="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="16" y2="5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="14" y2="16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
      <circle cx="4" cy="4" r="2" fill="currentColor" />
      <circle cx="16" cy="5" r="2" fill="currentColor" />
      <circle cx="14" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}

const MODE_ICON: Record<AppMode, () => React.JSX.Element> = {
  [APP_MODES.PERIODIC_TABLE]: PeriodicTableIcon,
  [APP_MODES.MOLECULES]: MoleculeIcon,
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
            const label = t(MODE_LABEL_KEY[mode]);
            const Icon = MODE_ICON[mode];
            return (
              <li key={mode}>
                <a
                  className="segmented__item"
                  href={href}
                  data-active={isActive || undefined}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={label}
                  title={label}
                >
                  <Icon />
                  <span className="navbar__mode-label">{label}</span>
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

        <button
          type="button"
          className="control navbar__dictionary"
          onClick={handleOpenDictionary}
          aria-label={t('nav.dictionary')}
          title={t('nav.dictionary')}
        >
          <span className="navbar__dictionary-icon" aria-hidden="true">
            ?
          </span>
          <span className="navbar__dictionary-label">{t('nav.dictionary')}</span>
        </button>
      </div>
    </nav>
  );
}
