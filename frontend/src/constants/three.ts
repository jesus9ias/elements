/**
 * Shared Three.js scene constants, consumed by `src/three/scene-lifecycle.ts`
 * and reused by the Bohr-model animation (Stage 5) and molecule viewer (Stage 6).
 */

export const CAMERA = {
  FOV_DEGREES: 50,
  NEAR: 0.1,
  FAR: 1000,
  INITIAL_POSITION_Z: 5,
} as const;

export const RENDERER = {
  /** Cap devicePixelRatio to avoid over-rendering on high-DPI screens. */
  MAX_PIXEL_RATIO: 2,
  ANTIALIAS: true,
  /** Transparent canvas so the glassmorphism background shows through. */
  ALPHA: true,
  CLEAR_ALPHA: 0,
} as const;
