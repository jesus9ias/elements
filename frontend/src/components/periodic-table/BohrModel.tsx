/**
 * Bohr-model 3D animation (Stage 5).
 *
 * Renders a nucleus of individual protons/neutrons plus electrons in real
 * shells (from the element's Wikidata electron configuration), each group as
 * its own `THREE.InstancedMesh` to keep draw calls low. Electrons orbit
 * continuously at a uniform angular speed; the previous element's scene is
 * fully disposed before the next is built (the effect's cleanup runs on every
 * atomic-number change), satisfying the dispose-on-navigation criterion.
 */

import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
  type ColorRepresentation,
} from 'three';

import { mountScene, type SceneContext } from '../../three/scene-lifecycle';
import {
  PARTICLE_RADIUS,
  PARTICLE_SEGMENTS,
  NUCLEUS_RADIUS,
  SHELL_BASE_RADIUS,
  SHELL_RADIUS_STEP,
  ELECTRON_ANGULAR_SPEED,
  SHELL_TILT_STEP_RADIANS,
  NUCLEUS_SPIN_SPEED,
  CAMERA_DISTANCE,
  neutronCount,
} from '../../constants/bohr';

interface BohrModelProps {
  atomicNumber: number;
  atomicMass: number | null;
  /** Electrons per shell, from the merged element record. */
  electronConfiguration: string[];
  /** Accessible label for the canvas region. */
  label: string;
}

/** Read a CSS custom-property color so tokens.css stays the single source. */
function cssColor(token: string): ColorRepresentation {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return new Color(value || '#ffffff');
}

/** A random point inside a sphere of the given radius (for nucleus packing). */
function randomPointInSphere(radius: number, into: Vector3): Vector3 {
  // Rejection sampling keeps the distribution uniform without a cube-root.
  let x: number, y: number, z: number;
  do {
    x = Math.random() * 2 - 1;
    y = Math.random() * 2 - 1;
    z = Math.random() * 2 - 1;
  } while (x * x + y * y + z * z > 1);
  return into.set(x * radius, y * radius, z * radius);
}

/** Build an instanced sphere group of `count` particles; null when empty. */
function buildParticles(
  count: number,
  radius: number,
  color: ColorRepresentation,
): InstancedMesh | null {
  if (count <= 0) return null;
  const geometry = new SphereGeometry(
    radius,
    PARTICLE_SEGMENTS.WIDTH,
    PARTICLE_SEGMENTS.HEIGHT,
  );
  const material = new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 });
  return new InstancedMesh(geometry, material, count);
}

/** Per-electron orbit parameters, precomputed once per element. */
interface ElectronOrbit {
  radius: number;
  baseAngle: number;
  /** Orientation of this electron's shell plane. */
  tilt: Quaternion;
}

export default function BohrModel({
  atomicNumber,
  atomicMass,
  electronConfiguration,
  label,
}: BohrModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const protons = atomicNumber;
    const neutrons = neutronCount(atomicNumber, atomicMass);
    const shells = electronConfiguration
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);

    const dummy = new Object3D();
    const scratch = new Vector3();

    let nucleusGroup: Group | null = null;
    let electronMesh: InstancedMesh | null = null;
    let orbits: ElectronOrbit[] = [];
    let elapsed = 0;

    const handle = mountScene(container, {
      init(ctx: SceneContext) {
        ctx.scene.add(new AmbientLight(0xffffff, 0.7));
        const key = new DirectionalLight(0xffffff, 1.1);
        key.position.set(3, 4, 5);
        ctx.scene.add(key);

        // Frame larger atoms from further back.
        ctx.camera.position.z =
          CAMERA_DISTANCE.BASE + shells.length * CAMERA_DISTANCE.PER_SHELL;

        // --- Nucleus: protons + neutrons packed into a jittered sphere ---
        nucleusGroup = new Group();
        const protonMesh = buildParticles(
          protons,
          PARTICLE_RADIUS.PROTON,
          cssColor('--particle-proton'),
        );
        const neutronMesh = buildParticles(
          neutrons,
          PARTICLE_RADIUS.NEUTRON,
          cssColor('--particle-neutron'),
        );
        for (const [mesh, n] of [
          [protonMesh, protons],
          [neutronMesh, neutrons],
        ] as const) {
          if (!mesh) continue;
          for (let i = 0; i < n; i += 1) {
            randomPointInSphere(NUCLEUS_RADIUS, scratch);
            dummy.position.copy(scratch);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
          }
          mesh.instanceMatrix.needsUpdate = true;
          nucleusGroup.add(mesh);
        }
        ctx.scene.add(nucleusGroup);

        // --- Electrons: one instanced mesh, orbit params precomputed ---
        orbits = [];
        shells.forEach((countInShell, shellIndex) => {
          const radius = SHELL_BASE_RADIUS + shellIndex * SHELL_RADIUS_STEP;
          const tilt = new Quaternion().setFromAxisAngle(
            new Vector3(1, 0.4, 0).normalize(),
            shellIndex * SHELL_TILT_STEP_RADIANS,
          );
          for (let k = 0; k < countInShell; k += 1) {
            orbits.push({
              radius,
              baseAngle: (k / countInShell) * Math.PI * 2,
              tilt,
            });
          }
        });

        electronMesh = buildParticles(
          orbits.length,
          PARTICLE_RADIUS.ELECTRON,
          cssColor('--particle-electron'),
        );
        if (electronMesh) ctx.scene.add(electronMesh);
      },

      update(_ctx, deltaSeconds) {
        elapsed += deltaSeconds;

        if (nucleusGroup) nucleusGroup.rotation.y += NUCLEUS_SPIN_SPEED * deltaSeconds;

        if (electronMesh) {
          const angleNow = elapsed * ELECTRON_ANGULAR_SPEED;
          orbits.forEach((orbit, i) => {
            const theta = orbit.baseAngle + angleNow;
            scratch
              .set(Math.cos(theta) * orbit.radius, Math.sin(theta) * orbit.radius, 0)
              .applyQuaternion(orbit.tilt);
            dummy.position.copy(scratch);
            dummy.updateMatrix();
            electronMesh!.setMatrixAt(i, dummy.matrix);
          });
          electronMesh.instanceMatrix.needsUpdate = true;
        }
      },
    });

    // Cleanup: dispose the whole scene before the next element builds.
    return () => handle.dispose();
  }, [atomicNumber, atomicMass, electronConfiguration]);

  return <div className="bohr-model" ref={containerRef} role="img" aria-label={label} />;
}
