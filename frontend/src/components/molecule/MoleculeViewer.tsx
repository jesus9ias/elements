/**
 * Molecule 3D viewer (Stage 6).
 *
 * Renders a precomputed conformer from `molecules.json`: atoms as CPK-colored
 * spheres sized per element, bonds as cylinders whose count/style come from the
 * shared `bonds.ts` mapping (single = 1, double/triple = N parallel, aromatic =
 * 1 solid + 1 dashed). No embedding runs here — geometry is read as-is.
 *
 * Reuses the Stage 1 scene-lifecycle utility and a small manual orbit/zoom
 * controller (drag to rotate, wheel to zoom); the scene is fully disposed when
 * the selected molecule changes.
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
  SphereGeometry,
  CylinderGeometry,
  Vector3,
  type ColorRepresentation,
} from 'three';

import { mountScene, type SceneContext } from '../../three/scene-lifecycle';
import { bondStyleFor, type BondOrder } from '../../constants/bonds';
import type { MoleculeAtom, MoleculeBond } from '../../constants/molecules';
import {
  ATOM_RADII,
  ATOM_RADIUS_DEFAULT,
  ATOM_SEGMENTS,
  BOND_RADIUS,
  BOND_RADIAL_SEGMENTS,
  BOND_DOUBLE_OFFSET,
  BOND_TRIPLE_OFFSET,
  BOND_AROMATIC_OFFSET,
  DASH_SEGMENTS,
  DASH_FILL_RATIO,
  CAMERA_FIT_FACTOR,
  CAMERA_MIN_DISTANCE,
  ZOOM_MIN_FACTOR,
  ZOOM_MAX_FACTOR,
  ORBIT_SPEED,
  ZOOM_SPEED,
} from '../../constants/molecule-viewer';

interface MoleculeViewerProps {
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  label: string;
}

const UP = new Vector3(0, 1, 0);

function cssColor(token: string): ColorRepresentation {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return new Color(value || '#ffffff');
}

/** Unit-vector perpendicular to `dir`, stable regardless of orientation. */
function perpendicular(dir: Vector3, into: Vector3): Vector3 {
  const reference = Math.abs(dir.y) < 0.9 ? UP : new Vector3(1, 0, 0);
  return into.crossVectors(dir, reference).normalize();
}

export default function MoleculeViewer({ atoms, bonds, label }: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Center the conformer on its centroid so it orbits about the middle.
    const centroid = atoms
      .reduce((acc, a) => acc.add(new Vector3(a.x, a.y, a.z)), new Vector3())
      .divideScalar(Math.max(atoms.length, 1));
    const positions = atoms.map((a) => new Vector3(a.x, a.y, a.z).sub(centroid));
    const boundingRadius = positions.reduce((max, p) => Math.max(max, p.length()), 0.5);
    const fitDistance = Math.max(boundingRadius * CAMERA_FIT_FACTOR, CAMERA_MIN_DISTANCE);

    const dummy = new Object3D();
    const dir = new Vector3();
    const perp = new Vector3();
    const mid = new Vector3();

    const group = new Group();
    let rotX = 0.35;
    let rotY = 0.6;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let distance = fitDistance;

    const onPointerDown = (e: PointerEvent): void => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      container.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * ORBIT_SPEED;
      rotX += (e.clientY - lastY) * ORBIT_SPEED;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent): void => {
      dragging = false;
      if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      distance *= 1 + e.deltaY * ZOOM_SPEED;
      distance = Math.min(
        Math.max(distance, fitDistance * ZOOM_MIN_FACTOR),
        fitDistance * ZOOM_MAX_FACTOR,
      );
    };

    const handle = mountScene(container, {
      init(ctx: SceneContext) {
        ctx.scene.add(new AmbientLight(0xffffff, 0.75));
        const key = new DirectionalLight(0xffffff, 1.0);
        key.position.set(4, 6, 8);
        ctx.scene.add(key);
        ctx.camera.position.z = distance;

        // --- Atoms: one instanced sphere, per-instance scale + CPK color ---
        const atomGeometry = new SphereGeometry(1, ATOM_SEGMENTS.WIDTH, ATOM_SEGMENTS.HEIGHT);
        const atomMaterial = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 });
        const atomMesh = new InstancedMesh(atomGeometry, atomMaterial, atoms.length);
        atoms.forEach((atom, i) => {
          const radius = ATOM_RADII[atom.element] ?? ATOM_RADIUS_DEFAULT;
          dummy.position.copy(positions[i]!);
          dummy.scale.setScalar(radius);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          atomMesh.setMatrixAt(i, dummy.matrix);
          atomMesh.setColorAt(i, new Color(atom.color));
        });
        atomMesh.instanceMatrix.needsUpdate = true;
        if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true;
        group.add(atomMesh);

        // --- Bonds: count solid + dashed cylinder segments, then fill ---
        let solidCount = 0;
        let dashedCount = 0;
        for (const bond of bonds) {
          const style = bondStyleFor(bond.order as BondOrder);
          if (style.dashed) {
            solidCount += style.cylinders - 1;
            dashedCount += DASH_SEGMENTS;
          } else {
            solidCount += style.cylinders;
          }
        }

        const bondColor = cssColor('--bond-color');
        const cylinderGeometry = new CylinderGeometry(1, 1, 1, BOND_RADIAL_SEGMENTS);
        const bondMaterial = new MeshStandardMaterial({
          color: bondColor,
          roughness: 0.5,
          metalness: 0.05,
        });
        const solidMesh = new InstancedMesh(cylinderGeometry, bondMaterial, solidCount);
        const dashedMesh = new InstancedMesh(cylinderGeometry, bondMaterial, dashedCount);

        let solidIndex = 0;
        let dashedIndex = 0;

        /** Place one cylinder instance spanning a→b into `mesh`. */
        const placeCylinder = (
          mesh: InstancedMesh,
          index: number,
          a: Vector3,
          b: Vector3,
        ): void => {
          dir.subVectors(b, a);
          const length = dir.length();
          mid.copy(a).add(b).multiplyScalar(0.5);
          dummy.position.copy(mid);
          dummy.scale.set(BOND_RADIUS, length, BOND_RADIUS);
          dummy.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
        };

        /** Place a dashed cylinder as DASH_SEGMENTS short segments along a→b. */
        const placeDashed = (a: Vector3, b: Vector3): void => {
          const cell = 1 / DASH_SEGMENTS;
          for (let s = 0; s < DASH_SEGMENTS; s += 1) {
            const t0 = s * cell;
            const t1 = t0 + cell * DASH_FILL_RATIO;
            const start = a.clone().lerp(b, t0);
            const end = a.clone().lerp(b, t1);
            placeCylinder(dashedMesh, dashedIndex++, start, end);
          }
        };

        for (const bond of bonds) {
          const style = bondStyleFor(bond.order as BondOrder);
          const a = positions[bond.from]!;
          const b = positions[bond.to]!;
          dir.subVectors(b, a);
          perpendicular(dir, perp);

          if (style.dashed) {
            // Aromatic: one solid on the axis, one dashed offset to the side.
            placeCylinder(solidMesh, solidIndex++, a, b);
            const off = perp.clone().multiplyScalar(BOND_AROMATIC_OFFSET);
            placeDashed(a.clone().add(off), b.clone().add(off));
          } else if (style.cylinders === 1) {
            placeCylinder(solidMesh, solidIndex++, a, b);
          } else {
            // Double/triple: N parallel cylinders offset symmetrically.
            const offset = style.cylinders === 2 ? BOND_DOUBLE_OFFSET : BOND_TRIPLE_OFFSET;
            const start = -(style.cylinders - 1) / 2;
            for (let c = 0; c < style.cylinders; c += 1) {
              const shift = perp.clone().multiplyScalar((start + c) * offset);
              placeCylinder(solidMesh, solidIndex++, a.clone().add(shift), b.clone().add(shift));
            }
          }
        }

        solidMesh.instanceMatrix.needsUpdate = true;
        dashedMesh.instanceMatrix.needsUpdate = true;
        group.add(solidMesh);
        group.add(dashedMesh);

        ctx.scene.add(group);

        container.style.touchAction = 'none';
        container.addEventListener('pointerdown', onPointerDown);
        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerup', onPointerUp);
        container.addEventListener('wheel', onWheel, { passive: false });
      },

      update(ctx) {
        group.rotation.x = rotX;
        group.rotation.y = rotY;
        ctx.camera.position.z = distance;
      },

      dispose() {
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerup', onPointerUp);
        container.removeEventListener('wheel', onWheel);
      },
    });

    return () => handle.dispose();
  }, [atoms, bonds]);

  return <div className="molecule-viewer" ref={containerRef} role="img" aria-label={label} />;
}
