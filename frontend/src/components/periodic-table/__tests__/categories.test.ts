import { describe, it, expect } from 'vitest';

// Category colors implemented in Stage 5 — does not exist yet, so this suite is RED.
import { categoryColor } from '../../../constants/categories';

describe('element categories (T-ELEM)', () => {
  it('T-ELEM-02: category color mapping is deterministic', () => {
    const first = categoryColor('noble-gas');

    expect(first).toBe('--category-noble-gas');
    // Deterministic: the same group always maps to the same token.
    expect(categoryColor('noble-gas')).toBe(first);
  });
});
