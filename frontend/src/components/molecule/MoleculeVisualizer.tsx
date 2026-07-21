/**
 * Molecule Visualizer mode (Stage 6) — inventory (list/info tabs, search) plus
 * the 3D viewer. Replaces the Stage 1 placeholder for the /molecules route.
 *
 * No molecule is selected on first load (the viewer shows an empty-state
 * message). Selecting one flips the inventory to the Info tab and renders the
 * conformer; returning to the List tab keeps the selection.
 */

import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../i18n/config';
import './molecule.css';
import { moleculesSortedByName, moleculeById } from './molecule-data';
import {
  INITIAL_INVENTORY,
  filterMolecules,
  selectMolecule,
  showTab,
  type InventoryTab,
} from './inventory';
import InventoryPanel from './InventoryPanel';

// Three.js is only pulled in when a molecule is actually viewed.
const MoleculeViewer = lazy(() => import('./MoleculeViewer'));

export default function MoleculeVisualizer() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [query, setQuery] = useState('');

  const molecules = useMemo(() => moleculesSortedByName(language), [language]);
  const filtered = useMemo(
    () => filterMolecules(molecules, query, language),
    [molecules, query, language],
  );
  const selectedMolecule = inventory.selectedId
    ? moleculeById(inventory.selectedId)
    : undefined;

  const onSelect = (id: string): void => setInventory((s) => selectMolecule(s, id));
  const onShowTab = (tab: InventoryTab): void => setInventory((s) => showTab(s, tab));

  return (
    <div className="molecule-mode">
      <InventoryPanel
        molecules={molecules}
        filtered={filtered}
        state={inventory}
        query={query}
        language={language}
        selectedMolecule={selectedMolecule}
        onQueryChange={setQuery}
        onSelect={onSelect}
        onShowTab={onShowTab}
      />

      <div className="molecule-stage glass">
        {selectedMolecule ? (
          <Suspense fallback={<div className="molecule-viewer" aria-hidden="true" />}>
            <MoleculeViewer
              key={selectedMolecule.id}
              atoms={selectedMolecule.atoms}
              bonds={selectedMolecule.bonds}
              label={selectedMolecule.i18n[language]?.name ?? selectedMolecule.id}
            />
          </Suspense>
        ) : (
          <p className="molecule-stage__empty">{t('molecule.noSelection')}</p>
        )}
      </div>
    </div>
  );
}
