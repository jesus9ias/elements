import { describe, it, expect } from 'vitest';

// Implemented in Stage 7 — does not exist yet, so this suite is RED.
import { sortTerms, filterTerms } from '../dictionary';

const terms = [
  { term: 'SMILES', definition: 'Notación textual de estructuras químicas.' },
  { term: 'Isótopo', definition: 'Variante de un elemento por número de neutrones.' },
  { term: 'Aromático', definition: 'Sistema de enlaces deslocalizados.' },
];

describe('dictionary (T-DICT)', () => {
  it('T-DICT-01: terms are ordered alphabetically', () => {
    expect(sortTerms(terms).map((t) => t.term)).toEqual([
      'Aromático',
      'Isótopo',
      'SMILES',
    ]);
  });

  it('T-DICT-02: the filter narrows the list to matching terms', () => {
    expect(filterTerms(terms, 'smi').map((t) => t.term)).toEqual(['SMILES']);
  });

  it('T-DICT-03: a deep-link pre-filters to a specific term', () => {
    const filtered = filterTerms(terms, 'SMILES');

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.term).toBe('SMILES');
  });
});
