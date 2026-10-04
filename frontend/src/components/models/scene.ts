import * as THREE from 'three';

import type { ModelKind } from '@/api/types';

import { buildLandmarkModel, greyOut } from './builders';

export interface ModelScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  model: THREE.Group;
}

/** Scene, lights and camera for one landmark diorama. */
export function createModelScene(kind: ModelKind, aspect: number, locked = false): ModelScene {
  const scene = new THREE.Scene();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const model = buildLandmarkModel(kind);
  if (locked) greyOut(model);
  model.rotation.y = -0.5;
  scene.add(model);

  const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100);
  const target = new THREE.Vector3(0, 0.55, 0);
  const distance = 6.9;
  const elevation = THREE.MathUtils.degToRad(26);
  camera.position.set(0, target.y + distance * Math.sin(elevation), distance * Math.cos(elevation));
  camera.lookAt(target);

  return { scene, camera, model };
}

/**
 * Scene for any model, with the camera placed so the whole model fits
 * (used by the statues, trophies, podium and shelf).
 */
export function createFittedScene(
  model: THREE.Group,
  aspect: number,
  { elevation = 18, padding = 1.12, fov = 30 }: { elevation?: number; padding?: number; fov?: number } = {},
): ModelScene {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(3, 6, 5);
  const rim = new THREE.DirectionalLight(0xbcd7ff, 0.9);
  rim.position.set(-5, 3, -2);
  scene.add(sun, rim);
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const half = THREE.MathUtils.degToRad(fov / 2);
  const wide = Math.max(size.x, size.z); // the model may turn
  const distV = ((size.y / 2) * padding) / Math.tan(half);
  const distH = ((wide / 2) * padding) / (Math.tan(half) * aspect);
  const distance = Math.max(distV, distH) + wide / 2;
  const elev = THREE.MathUtils.degToRad(elevation);
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, 200);
  camera.position.set(center.x, center.y + Math.sin(elev) * distance, center.z + Math.cos(elev) * distance);
  camera.lookAt(center);
  return { scene, camera, model };
}
