import { describe, it, expect } from 'vitest';

// Implemented in Stage 4 — does not exist yet, so this suite is RED.
import { bondStyleFor, cpkColor } from '../bonds';

describe('bonds (T-BOND)', () => {
  it('T-BOND-01: a single bond is one solid cylinder', () => {
    expect(bondStyleFor('single')).toEqual({ style: 'solid', cylinders: 1 });
  });

  it('T-BOND-02: a double bond is two parallel solid cylinders', () => {
    expect(bondStyleFor('double')).toEqual({ style: 'solid-parallel', cylinders: 2 });
  });

  it('T-BOND-03: a triple bond is three parallel solid cylinders', () => {
    expect(bondStyleFor('triple')).toEqual({ style: 'solid-parallel', cylinders: 3 });
  });

  it('T-BOND-04: an aromatic bond is one solid + one dashed cylinder', () => {
    expect(bondStyleFor('aromatic').style).toBe('solid+dashed');
  });

  it('T-BOND-05: oxygen uses the CPK red', () => {
    expect(cpkColor('O')).toBe('#FF0000');
  });
});
