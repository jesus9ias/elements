/**
 * Shared Three.js scene lifecycle utility.
 *
 * Built once here and reused by both the Bohr-model animation (Stage 5) and
 * the molecule viewer (Stage 6). It owns the boilerplate that both scenes need:
 * renderer/camera setup, a resize observer, a render loop, and — critically —
 * FULL disposal of every GPU resource when the scene is torn down, so nothing
 * accumulates across prev/next navigations (see spec dispose-on-navigation
 * acceptance criterion).
 *
 * Callers provide hooks; they never touch the renderer's lifecycle directly.
 */

import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Object3D,
} from 'three';

import { CAMERA, RENDERER } from '../constants/three';

/** What every hook receives. */
export interface SceneContext {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly container: HTMLElement;
}

export interface SceneHooks {
  /** Build the scene contents once, right after setup. */
  readonly init?: (ctx: SceneContext) => void;
  /** Called every frame with the seconds elapsed since the previous frame. */
  readonly update?: (ctx: SceneContext, deltaSeconds: number) => void;
  /** Optional extra teardown for resources the caller created outside the scene graph. */
  readonly dispose?: (ctx: SceneContext) => void;
}

/** Handle returned to the caller; calling `dispose` tears everything down. */
export interface SceneHandle {
  dispose: () => void;
}

/** A resource exposing a `dispose()` method (geometry, material, texture). */
interface Disposable {
  dispose: () => void;
}

function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispose' in value &&
    typeof (value as { dispose: unknown }).dispose === 'function'
  );
}

function isTexture(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'isTexture' in value;
}

/** Dispose of a material's own resources plus any textures it references. */
function disposeMaterial(material: Disposable & Record<string, unknown>): void {
  for (const value of Object.values(material)) {
    if (isTexture(value) && isDisposable(value)) {
      value.dispose();
    }
  }
  material.dispose();
}

/** Recursively dispose of every geometry/material under an object. */
function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Object3D & {
      geometry?: { dispose: () => void };
      material?:
        | { dispose: () => void; [key: string]: unknown }
        | Array<{ dispose: () => void; [key: string]: unknown }>;
    };

    mesh.geometry?.dispose();

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeMaterial);
    } else if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

/**
 * Mount a scene into `container` and start its render loop.
 * The returned handle's `dispose()` is idempotent.
 */
export function mountScene(
  container: HTMLElement,
  hooks: SceneHooks = {},
): SceneHandle {
  const scene = new Scene();

  const camera = new PerspectiveCamera(
    CAMERA.FOV_DEGREES,
    container.clientWidth / Math.max(container.clientHeight, 1),
    CAMERA.NEAR,
    CAMERA.FAR,
  );
  camera.position.z = CAMERA.INITIAL_POSITION_Z;

  const renderer = new WebGLRenderer({
    antialias: RENDERER.ANTIALIAS,
    alpha: RENDERER.ALPHA,
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, RENDERER.MAX_PIXEL_RATIO),
  );
  renderer.setClearAlpha(RENDERER.CLEAR_ALPHA);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const context: SceneContext = { scene, camera, renderer, container };

  const resize = (): void => {
    const width = container.clientWidth;
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let frameId = 0;
  let disposed = false;
  let lastTimestamp: number | null = null;

  // `requestAnimationFrame` passes a DOMHighResTimeStamp; we derive the
  // per-frame delta from it (replaces the deprecated THREE.Clock).
  const renderFrame = (timestamp: number): void => {
    if (disposed) return;
    const deltaSeconds =
      lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    hooks.update?.(context, deltaSeconds);
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(renderFrame);
  };

  hooks.init?.(context);
  frameId = window.requestAnimationFrame(renderFrame);

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    window.cancelAnimationFrame(frameId);
    resizeObserver.disconnect();

    hooks.dispose?.(context);
    disposeObject(scene);
    scene.clear();

    renderer.dispose();
    renderer.domElement.remove();
  };

  return { dispose };
}
