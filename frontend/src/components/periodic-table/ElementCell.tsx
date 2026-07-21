/**
 * A single periodic-table cell: symbol, atomic number, name and atomic mass,
 * tinted by category. Positions itself on the shared grid via its {row, column}.
 */

import { useTranslation } from 'react-i18next';

import { categoryColor } from '../../constants/categories';
import type { ElementRecord } from '../../constants/elements';
import type { GridPosition } from './layout';
import { formatMass } from './format';

interface ElementCellProps {
  element: ElementRecord;
  position: GridPosition;
  selected: boolean;
  onSelect: (atomicNumber: number) => void;
}

export default function ElementCell({
  element,
  position,
  selected,
  onSelect,
}: ElementCellProps) {
  const { t } = useTranslation();
  const token = categoryColor(element.group as Parameters<typeof categoryColor>[0]);

  return (
    <button
      type="button"
      className="element-cell"
      // Without this the button's name is the raw concatenation of its spans.
      aria-label={t('periodicTable.cellLabel', {
        name: element.name,
        symbol: element.symbol,
        number: element.atomicNumber,
      })}
      data-selected={selected || undefined}
      style={{
        gridRow: position.row,
        gridColumn: position.column,
        // Reference the category token from tokens.css (no inline colors). The
        // stylesheet derives every tint it needs from this one value.
        ['--cell-color' as string]: `var(${token})`,
      }}
      aria-pressed={selected}
      onClick={() => onSelect(element.atomicNumber)}
    >
      <span className="element-cell__number">{element.atomicNumber}</span>
      <span className="element-cell__symbol">{element.symbol}</span>
      <span className="element-cell__name">{element.name}</span>
      <span className="element-cell__mass">{formatMass(element.atomicMass)}</span>
    </button>
  );
}
