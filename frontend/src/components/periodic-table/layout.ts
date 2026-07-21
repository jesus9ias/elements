/**
 * Periodic-table grid geometry — maps each atomic number to its {row, column}
 * in the classic 18-column layout, with the f-block (lanthanides, actinides)
 * pulled out into their own rows below the main body.
 *
 * Fixed reference data expressed as rules rather than a 118-entry table, so the
 * placement logic is auditable at a glance. Columns and rows are 1-indexed to
 * line up directly with CSS grid lines.
 */

export const PERIODIC_TABLE_COLUMNS = 18;

/** Main body occupies rows 1–7; the f-block sits below a spacer row. */
export const MAIN_PERIOD_ROWS = 7;
export const LANTHANIDE_ROW = 9;
export const ACTINIDE_ROW = 10;

/** First column the f-block series occupy in their own rows. */
const F_BLOCK_START_COLUMN = 3;

/** Atomic-number ranges of the two f-block series. */
export const LANTHANIDE_RANGE = { first: 57, last: 71 } as const;
export const ACTINIDE_RANGE = { first: 89, last: 103 } as const;

export interface GridPosition {
  row: number;
  column: number;
}

function inRange(z: number, range: { first: number; last: number }): boolean {
  return z >= range.first && z <= range.last;
}

/**
 * The main-body cell (group 3, periods 6 and 7) that stands in for a whole
 * f-block series. Rendered as a non-interactive marker that points at the row
 * below, matching the conventional printed layout.
 */
export interface FBlockPlaceholder {
  row: number;
  column: number;
  series: 'lanthanide' | 'actinide';
}

export const F_BLOCK_PLACEHOLDERS: readonly FBlockPlaceholder[] = [
  { row: 6, column: F_BLOCK_START_COLUMN, series: 'lanthanide' },
  { row: 7, column: F_BLOCK_START_COLUMN, series: 'actinide' },
];

/**
 * Grid position for an atomic number, or null if out of the 1–118 range.
 * Expressed as per-period rules; see the periodic table's standard shape.
 */
export function positionFor(atomicNumber: number): GridPosition | null {
  const z = atomicNumber;
  if (z < 1 || z > 118) return null;

  // Period 1: hydrogen far left, helium far right.
  if (z === 1) return { row: 1, column: 1 };
  if (z === 2) return { row: 1, column: PERIODIC_TABLE_COLUMNS };

  // Periods 2–3: two s-block elements on the left, p-block on the right.
  if (z <= 10) return { row: 2, column: z <= 4 ? z - 2 : z + 8 };
  if (z <= 18) return { row: 3, column: z <= 12 ? z - 10 : z };

  // Periods 4–5: fully contiguous across all 18 columns.
  if (z <= 36) return { row: 4, column: z - 18 };
  if (z <= 54) return { row: 5, column: z - 36 };

  // f-block series live in their own rows, columns 3–17.
  if (inRange(z, LANTHANIDE_RANGE)) {
    return { row: LANTHANIDE_ROW, column: z - LANTHANIDE_RANGE.first + F_BLOCK_START_COLUMN };
  }
  if (inRange(z, ACTINIDE_RANGE)) {
    return { row: ACTINIDE_ROW, column: z - ACTINIDE_RANGE.first + F_BLOCK_START_COLUMN };
  }

  // Period 6: Cs, Ba, then (lanthanides pulled out) Hf…Rn in columns 4–18.
  if (z <= 56) return { row: 6, column: z - 54 };
  if (z <= 86) return { row: 6, column: z - 68 };

  // Period 7: Fr, Ra, then (actinides pulled out) Rf…Og in columns 4–18.
  if (z <= 88) return { row: 7, column: z - 86 };
  return { row: 7, column: z - 100 };
}
