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
