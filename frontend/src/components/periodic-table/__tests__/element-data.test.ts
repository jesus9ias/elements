import { describe, it, expect } from 'vitest';

// Committed pipeline output, generated in Stage 4.
import elementsEs from '../../../config/elements.es.json';

describe('element data (T-ELEM)', () => {
  it('T-ELEM-01: electron configuration comes from the Wikidata claim, including exceptions', () => {
    // Chromium (Z=24): [Ar] 3d5 4s1 → shells 2,8,13,1 — the real exception,
    // NOT what a simplified 2n²/Aufbau-per-shell rule would produce.
    const chromium = (elementsEs as Record<string, { electronConfiguration: string[] }>)['24'];

    expect(chromium.electronConfiguration).toEqual(['2', '8', '13', '1']);
  });
});
