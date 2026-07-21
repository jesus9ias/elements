/**
 * Dictionary modal (Stage 7).
 *
 * Mounted once by the layout as its own island. Opens either from the navbar
 * button (whole list) or from any contextual "?" icon, which deep-links by
 * pre-filtering to that term. Both arrive as a window CustomEvent, since Astro
 * islands are separate React roots.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../i18n/config';
import './dictionary.css';
import {
  DICTIONARY_OPEN_EVENT,
  type DictionaryOpenDetail,
} from '../../constants/dictionary';
import { sortTerms, filterTerms } from './dictionary';
import { termsFor } from './dictionary-data';

export default function DictionaryModal() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(() => sortTerms(termsFor(language), language), [language]);
  const visible = useMemo(() => filterTerms(terms, query), [terms, query]);

  const close = useCallback(() => setOpen(false), []);

  // Triggers (navbar, "?" icons) live in other islands and reach us by event.
  useEffect(() => {
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent<DictionaryOpenDetail>).detail;
      // A contextual "?" deep-links by pre-filtering to its term.
      setQuery(detail?.term ?? '');
      setOpen(true);
    };
    window.addEventListener(DICTIONARY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(DICTIONARY_OPEN_EVENT, onOpen);
  }, []);

  // Escape closes; focus moves into the filter so typing works immediately.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    inputRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="dictionary-backdrop" onClick={close}>
      <div
        className="dictionary glass glass--panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.dictionary')}
        // Clicks inside must not fall through to the backdrop's close.
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dictionary__header">
          <h2 className="dictionary__title">{t('nav.dictionary')}</h2>
          <button
            type="button"
            className="dictionary__close control control--icon"
            onClick={close}
            aria-label={t('periodicTable.close')}
          >
            ×
          </button>
        </header>

        <input
          ref={inputRef}
          type="search"
          className="dictionary__filter control control--input"
          placeholder={t('dictionary.filterPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('dictionary.filterPlaceholder')}
        />

        {visible.length === 0 ? (
          <p className="dictionary__empty">{t('dictionary.emptyState')}</p>
        ) : (
          <dl className="dictionary__list">
            {visible.map((entry) => (
              <div key={entry.term} className="dictionary__entry">
                <dt>{entry.term}</dt>
                <dd>{entry.definition}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
