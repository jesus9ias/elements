/**
 * Contextual "?" icon — opens the Dictionary modal pre-filtered to one term.
 * Usable from any island; it only dispatches the shared open event.
 */

import { useTranslation } from 'react-i18next';

import { openDictionary } from '../../constants/dictionary';

interface HelpIconProps {
  /** The dictionary term to deep-link to, exactly as written in terms.*.json. */
  term: string;
}

export default function HelpIcon({ term }: HelpIconProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="help-icon"
      onClick={() => openDictionary(term)}
      aria-label={t('dictionary.explainTerm', { term })}
      title={t('dictionary.explainTerm', { term })}
    >
      ?
    </button>
  );
}
