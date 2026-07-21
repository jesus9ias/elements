/**
 * Periodic Table mode (Stage 5) — the grid plus the element detail view.
 *
 * Replaces the Stage 1 placeholder for the periodic-table route. Element
 * content is chosen by the active UI language; the selected element opens the
 * detail view (a sidebar on desktop, a sheet on mobile), navigable with
 * prev/next without closing.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../i18n/config';
import './periodic-table.css';
import { ELEMENT_COUNT } from '../../constants/elements';
import type { Language } from '../../constants/i18n';
import { elementsFor, elementByNumber } from './element-data';
import { positionFor, F_BLOCK_PLACEHOLDERS, PERIODIC_TABLE_COLUMNS } from './layout';
import ElementCell from './ElementCell';
import ElementDetail from './ElementDetail';

const FIRST_ATOMIC_NUMBER = 1;

export default function PeriodicTable() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;

  const [selected, setSelected] = useState<number | null>(null);

  const elements = useMemo(() => elementsFor(language), [language]);
  const selectedElement =
    selected === null ? undefined : elementByNumber(language, selected);

  const goTo = (atomicNumber: number): void => {
    if (atomicNumber >= FIRST_ATOMIC_NUMBER && atomicNumber <= ELEMENT_COUNT) {
      setSelected(atomicNumber);
    }
  };

  return (
    <div className="periodic-table-mode" data-detail-open={selectedElement ? '' : undefined}>
      <div
        className="periodic-grid"
        // Deliberately NOT role="grid": that promises arrow-key grid navigation
        // we do not implement. A labelled group of buttons is the honest
        // semantic, and each cell carries its own accessible name.
        role="group"
        aria-label={t('modes.periodicTable')}
        style={{ ['--grid-columns' as string]: PERIODIC_TABLE_COLUMNS }}
      >
        {F_BLOCK_PLACEHOLDERS.map((placeholder) => (
          <div
            key={placeholder.series}
            className="periodic-grid__placeholder"
            style={{ gridRow: placeholder.row, gridColumn: placeholder.column }}
            aria-hidden="true"
          >
            {t(`periodicTable.series${placeholder.series === 'lanthanide' ? 'Lanthanide' : 'Actinide'}`)}
          </div>
        ))}

        {elements.map((element) => {
          const position = positionFor(element.atomicNumber);
          if (!position) return null;
          return (
            <ElementCell
              key={element.atomicNumber}
              element={element}
              position={position}
              selected={element.atomicNumber === selected}
              onSelect={goTo}
            />
          );
        })}
      </div>

      {selectedElement && (
        <ElementDetail
          element={selectedElement}
          canPrev={selectedElement.atomicNumber > FIRST_ATOMIC_NUMBER}
          canNext={selectedElement.atomicNumber < ELEMENT_COUNT}
          onPrev={() => goTo(selectedElement.atomicNumber - 1)}
          onNext={() => goTo(selectedElement.atomicNumber + 1)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
