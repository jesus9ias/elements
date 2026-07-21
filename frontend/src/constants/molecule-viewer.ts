/**
 * Molecule 3D viewer constants (Stage 6).
 *
 * Atoms are spheres sized per element (CPK convention pairs color with size);
 * bonds are cylinders whose count/style come from `bonds.ts` (single = 1,
 * double/triple = N parallel, aromatic = 1 solid + 1 dashed). Geometry is read
 * from the precomputed `molecules.json`; nothing is embedded in the browser.
 *
 * No magic values in the renderer: sizes, offsets and camera tuning live here.
 */

/**
 * Sphere radius per element, in the same Ångström-ish units as the conformer
 * coordinates. Loosely scaled covalent radii — enough that sizes read as
 * distinct without atoms swallowing their bonds. Unlisted elements use DEFAULT.
 */
export const ATOM_RADII: Record<string, number> = {
  H: 0.23,
  C: 0.34,
  N: 0.32,
  O: 0.31,
  F: 0.28,
  P: 0.42,
  S: 0.42,
  Cl: 0.4,
  Br: 0.44,
  I: 0.48,
};
export const ATOM_RADIUS_DEFAULT = 0.36;

/** Sphere tessellation — molecules are small, so this can be reasonably smooth. */
export const ATOM_SEGMENTS = { WIDTH: 20, HEIGHT: 20 } as const;

/** Cylinder radius for bonds, and the tessellation around the axis. */
export const BOND_RADIUS = 0.075;
export const BOND_RADIAL_SEGMENTS = 12;

/** Perpendicular offset between the parallel cylinders of multi-order bonds. */
export const BOND_DOUBLE_OFFSET = 0.11;
export const BOND_TRIPLE_OFFSET = 0.14;
/** Sideways offset of the dashed cylinder in an aromatic bond. */
export const BOND_AROMATIC_OFFSET = 0.11;

/** An aromatic bond's dashed cylinder is drawn as this many short segments. */
export const DASH_SEGMENTS = 6;
/** Fraction of each dash cell that is solid (the rest is the gap). */
export const DASH_FILL_RATIO = 0.55;

/** Camera framing: distance is the molecule's bounding radius times this, floored. */
export const CAMERA_FIT_FACTOR = 2.6;
export const CAMERA_MIN_DISTANCE = 3;
/** Wheel-zoom clamp, as multiples of the fitted distance. */
export const ZOOM_MIN_FACTOR = 0.4;
export const ZOOM_MAX_FACTOR = 2.5;

/** Manual orbit sensitivity (radians per pixel) and wheel zoom step. */
export const ORBIT_SPEED = 0.01;
export const ZOOM_SPEED = 0.0015;
