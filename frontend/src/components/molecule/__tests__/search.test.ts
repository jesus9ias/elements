import { describe, it, expect } from 'vitest';

// Implemented in Stage 6 — does not exist yet, so this suite is RED.
import {
  filterMolecules,
  selectMolecule,
  showTab,
  INITIAL_INVENTORY,
} from '../inventory';

const molecules = [
  { id: 'acetic-acid', i18n: { es: { name: 'Ácido acético' }, en: { name: 'Acetic acid' } } },
  { id: 'glucose', i18n: { es: { name: 'Glucosa' }, en: { name: 'Glucose' } } },
];

describe('molecule inventory (T-MOL)', () => {
  it('T-MOL-01: search is case- and accent-insensitive', () => {
    const result = filterMolecules(molecules, 'acido', 'es');

    expect(result.map((m) => m.id)).toContain('acetic-acid');
  });

  it('T-MOL-02: a query matching nothing yields an empty result (empty state)', () => {
    expect(filterMolecules(molecules, 'zzzzz', 'es')).toHaveLength(0);
  });

  it('T-MOL-03: selecting switches to the Info tab; returning to List preserves the selection', () => {
    const selected = selectMolecule(INITIAL_INVENTORY, 'acetic-acid');
    expect(selected.activeTab).toBe('info');
    expect(selected.selectedId).toBe('acetic-acid');

    const backToList = showTab(selected, 'list');
    expect(backToList.activeTab).toBe('list');
    expect(backToList.selectedId).toBe('acetic-acid');
  });
});
