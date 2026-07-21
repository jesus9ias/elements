import { describe, it, expect } from 'vitest';

// Implemented in Stage 4 — these modules do not exist yet, so this suite is RED.
import { mergeElement } from '../merge';
import { parseCliArgs } from '../fetch-elements';

/** A fully-populated element (every field present) — merge must NOT flag it. */
function completeElement() {
  return {
    atomicNumber: 26,
    symbol: 'Fe',
    name: 'Hierro',
    group: 'transition-metal',
    atomicMass: 55.845,
    meltingPointC: 1538,
    meltingPointK: 1811,
    boilingPointC: 2862,
    boilingPointK: 3135,
    discoveryDate: 'Antigüedad',
    discoverer: 'Desconocido',
    halfLife: 'Estable',
    knownIsotopes: ['Fe-54', 'Fe-56'],
    electronConfiguration: ['2', '8', '14', '2'],
    description: 'Generated description',
    uses: 'Generated uses',
    characteristics: 'Generated characteristics',
    sources: [{ label: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q677' }],
  };
}

describe('merge (T-DATA)', () => {
  it('T-DATA-01: a field-level override wins over generated content', () => {
    const generated = completeElement();
    const overrides = { description: 'Curated description' };

    const merged = mergeElement(generated, overrides);

    expect(merged.description).toBe('Curated description');
  });

  it('T-DATA-02: a non-overridden field uses the fresh generated value, not a stale one', () => {
    const generated = { ...completeElement(), description: 'Freshly fetched description' };
    const overrides = {}; // no override for description

    const merged = mergeElement(generated, overrides);

    expect(merged.description).toBe('Freshly fetched description');
  });

  it('T-DATA-03: a missing required field sets needsReview to true', () => {
    const generated = completeElement();
    delete (generated as Partial<ReturnType<typeof completeElement>>).discoverer;

    const merged = mergeElement(generated, {});

    expect(merged.needsReview).toBe(true);
  });

  it('T-DATA-04: a fully complete element is not flagged', () => {
    const merged = mergeElement(completeElement(), {});

    expect(merged.needsReview).toBe(false);
  });

  it('T-DATA-05: --element=<symbol> scopes the run to a single element', () => {
    expect(parseCliArgs(['--element=Fe'])).toEqual({ element: 'Fe', all: false });
  });
});
