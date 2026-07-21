/**
 * Molecule inventory — the left column's List and Info tabs.
 *
 * List: a search box over an alphabetical molecule list, with an empty state
 * when nothing matches. Info: the selected molecule's details, shown after a
 * selection (the parent flips the tab). Returning to List keeps the selection.
 */

import { useTranslation } from 'react-i18next';

import type { MoleculeRecord } from '../../constants/molecules';
import HelpIcon from '../dictionary/HelpIcon';
import { moleculeById } from './molecule-data';
import type { InventoryState, InventoryTab } from './inventory';

/** Dictionary term the SMILES "?" deep-links to (must match terms.*.json). */
const SMILES_TERM = 'SMILES';

interface InventoryProps {
  molecules: MoleculeRecord[];
  filtered: MoleculeRecord[];
  state: InventoryState;
  query: string;
  language: string;
  selectedMolecule: MoleculeRecord | undefined;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onShowTab: (tab: InventoryTab) => void;
}

const TABS: InventoryTab[] = ['list', 'info'];

export default function InventoryPanel({
  filtered,
  state,
  query,
  language,
  selectedMolecule,
  onQueryChange,
  onSelect,
  onShowTab,
}: InventoryProps) {
  const { t } = useTranslation();
  const name = (molecule: MoleculeRecord): string =>
    molecule.i18n[language]?.name ?? molecule.id;

  return (
    <div className="inventory glass glass--panel">
      <div className="inventory__tabs segmented" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={state.activeTab === tab}
            className="inventory__tab segmented__item"
            data-active={state.activeTab === tab || undefined}
            // The Info tab is only meaningful once something is selected.
            disabled={tab === 'info' && !selectedMolecule}
            onClick={() => onShowTab(tab)}
          >
            {t(`molecule.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {state.activeTab === 'list' && (
        <div className="inventory__list-tab">
          <input
            type="search"
            className="inventory__search control control--input"
            placeholder={t('molecule.searchPlaceholder')}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label={t('molecule.searchPlaceholder')}
          />
          {filtered.length === 0 ? (
            <p className="inventory__empty">{t('molecule.emptyState')}</p>
          ) : (
            <ul className="inventory__list">
              {filtered.map((molecule) => (
                <li key={molecule.id}>
                  <button
                    type="button"
                    className="inventory__item"
                    data-selected={molecule.id === state.selectedId || undefined}
                    onClick={() => onSelect(molecule.id)}
                  >
                    <span className="inventory__item-name">{name(molecule)}</span>
                    <span className="inventory__item-formula">{molecule.formula}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.activeTab === 'info' && selectedMolecule && (
        <MoleculeInfo molecule={selectedMolecule} language={language} />
      )}
    </div>
  );
}

function MoleculeInfo({
  molecule,
  language,
}: {
  molecule: MoleculeRecord;
  language: string;
}) {
  const { t } = useTranslation();
  const text = molecule.i18n[language];

  return (
    <div className="inventory__info" role="tabpanel">
      <h2 className="inventory__info-name">{text?.name ?? molecule.id}</h2>

      <dl className="inventory__info-facts">
        <div>
          <dt className="field__label">{t('molecule.fields.formula')}</dt>
          <dd className="field__value">{molecule.formula}</dd>
        </div>
        <div>
          <dt className="field__label">
            {t('molecule.fields.smiles')}
            <HelpIcon term={SMILES_TERM} />{' '}
            <span className="inventory__smiles-note">({t('molecule.smilesNote')})</span>
          </dt>
          <dd className="field__value inventory__smiles">{molecule.smiles}</dd>
        </div>
        <div>
          <dt className="field__label">{t('molecule.fields.type')}</dt>
          <dd className="field__value">{t(`moleculeTypes.${molecule.type}`)}</dd>
        </div>
        {molecule.isomers.length > 0 && (
          <div>
            <dt className="field__label">{t('molecule.fields.isomers')}</dt>
            <dd className="field__value">
              {molecule.isomers
                .map((id) => moleculeById(id)?.i18n[language]?.name ?? id)
                .join(', ')}
            </dd>
          </div>
        )}
      </dl>

      {text?.description && <p className="inventory__info-description">{text.description}</p>}
      {text?.uses && (
        <section className="inventory__info-prose">
          <h3>{t('molecule.fields.uses')}</h3>
          <p>{text.uses}</p>
        </section>
      )}

      {molecule.sources.length > 0 && (
        <footer className="inventory__info-sources">
          {molecule.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">
              {source.label}
            </a>
          ))}
        </footer>
      )}
    </div>
  );
}
