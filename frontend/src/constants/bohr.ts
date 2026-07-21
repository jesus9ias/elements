/**
 * Bohr-model rendering constants (Stage 5).
 *
 * The detail view animates a nucleus of individual protons/neutrons plus
 * electrons in real shells (from the Wikidata electron configuration), all
 * rendered with `THREE.InstancedMesh` to keep draw calls low even for Uranium
 * (~330 particles — the documented worst-case benchmark).
 *
 * No magic values in the renderer: every size, radius and speed lives here.
 */

/** Sphere radii, in scene units. */
export const PARTICLE_RADIUS = {
  PROTON: 0.14,
  NEUTRON: 0.14,
  ELECTRON: 0.09,
} as const;

/** Shared low-poly sphere tessellation — cheap, plenty for small spheres. */
export const PARTICLE_SEGMENTS = { WIDTH: 12, HEIGHT: 12 } as const;

/** Nucleus packing: particles are jittered inside a sphere of this radius. */
export const NUCLEUS_RADIUS = 0.55;

/** Electron shells: innermost radius and the gap added per subsequent shell. */
export const SHELL_BASE_RADIUS = 1.1;
export const SHELL_RADIUS_STEP = 0.62;

/**
 * Every electron advances at the SAME angular speed (spec decision: uniform,
 * not per-shell differentiated), in radians per second.
 */
export const ELECTRON_ANGULAR_SPEED = 0.9;

/**
 * Each shell's orbit plane is tilted by a fixed increment so the shells read as
 * a 3D cloud rather than flat concentric rings.
 */
export const SHELL_TILT_STEP_RADIANS = 0.5;

/** Slow nucleus spin, purely for depth cue (radians per second). */
export const NUCLEUS_SPIN_SPEED = 0.25;

/** Camera distance scales gently with shell count so large atoms stay framed. */
export const CAMERA_DISTANCE = {
  BASE: 4,
  PER_SHELL: 1.15,
} as const;

/**
 * Neutron count is derived from the mass number when a mass is known
 * (round(atomicMass) − protons); otherwise it falls back to the proton count,
 * a reasonable stand-in for a visualization of the heavy elements that lack a
 * standard atomic weight.
 */
export function neutronCount(atomicNumber: number, atomicMass: number | null): number {
  if (atomicMass === null) return atomicNumber;
  return Math.max(0, Math.round(atomicMass) - atomicNumber);
}
