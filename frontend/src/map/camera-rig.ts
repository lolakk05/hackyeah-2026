import * as THREE from 'three';

import type { P } from './osm';

const TILT_MIN = THREE.MathUtils.degToRad(18); // almost street level
const TILT_MAX = THREE.MathUtils.degToRad(85); // straight down
const DIST_MIN = 40;
const DIST_MAX = 2200;

/**
 * Orbit camera for the city: looks at a ground target from a distance, with
 * a compass angle (azimuth) and a tilt. Gestures change the "goal" values and
 * the camera glides towards them every frame.
 */
export class CameraRig {
  target: P = { x: 0, z: 0 };
  distance = 900;
  azimuth = 0.35;
  tilt = THREE.MathUtils.degToRad(48);

  goal = { target: { x: 0, z: 0 } as P, distance: 900, azimuth: 0.35, tilt: THREE.MathUtils.degToRad(48) };

  /** One-finger drag: rotate around and tilt. */
  rotateBy(dxPixels: number, dyPixels: number) {
    this.goal.azimuth -= dxPixels * 0.006;
    this.goal.tilt = THREE.MathUtils.clamp(this.goal.tilt + dyPixels * 0.005, TILT_MIN, TILT_MAX);
  }

  /** Two-finger twist. */
  twistBy(radians: number) {
    this.goal.azimuth -= radians;
  }

  /** Pinch: >1 zooms in. */
  zoomBy(scaleChange: number) {
    if (!Number.isFinite(scaleChange) || scaleChange <= 0) return;
    this.goal.distance = THREE.MathUtils.clamp(this.goal.distance / scaleChange, DIST_MIN, DIST_MAX);
  }

  /** Two-finger drag: move the map, relative to where the camera looks. */
  panBy(dxPixels: number, dyPixels: number, viewHeight: number) {
    const k = (this.goal.distance / Math.max(viewHeight, 1)) * 1.1;
    const sin = Math.sin(this.goal.azimuth);
    const cos = Math.cos(this.goal.azimuth);
    // On the ground: camera right = (cos, −sin), forward = (−sin, −cos).
    // Dragging right moves the map right (target goes left);
    // dragging down pulls the map towards you (target goes forward).
    const x = this.goal.target.x - dxPixels * k * cos - dyPixels * k * sin;
    const z = this.goal.target.z + dxPixels * k * sin - dyPixels * k * cos;
    this.goal.target = {
      x: THREE.MathUtils.clamp(x, -2500, 2500),
      z: THREE.MathUtils.clamp(z, -2500, 2500),
    };
  }

  flyTo(target: P, distance?: number, azimuth?: number, tilt?: number) {
    this.goal.target = { ...target };
    if (distance !== undefined) this.goal.distance = THREE.MathUtils.clamp(distance, DIST_MIN, DIST_MAX);
    if (azimuth !== undefined) this.goal.azimuth = this.nearestAngle(azimuth);
    if (tilt !== undefined) this.goal.tilt = THREE.MathUtils.clamp(tilt, TILT_MIN, TILT_MAX);
  }

  /** Point the camera so the view looks along a compass bearing (degrees). */
  headingTo(bearingDegrees: number) {
    // view direction (−sin az, −cos az) must equal the bearing (sin b, −cos b) → az = −b
    this.goal.azimuth = this.nearestAngle(-THREE.MathUtils.degToRad(bearingDegrees));
  }

  private nearestAngle(a: number) {
    const cur = this.goal.azimuth;
    return cur + Math.atan2(Math.sin(a - cur), Math.cos(a - cur));
  }

  /** Glide towards the goal and place the camera. */
  update(camera: THREE.PerspectiveCamera, smoothing = 0.18) {
    const g = this.goal;
    this.target = {
      x: this.target.x + (g.target.x - this.target.x) * smoothing,
      z: this.target.z + (g.target.z - this.target.z) * smoothing,
    };
    this.distance += (g.distance - this.distance) * smoothing;
    this.azimuth += (g.azimuth - this.azimuth) * smoothing;
    this.tilt += (g.tilt - this.tilt) * smoothing;

    const horiz = Math.cos(this.tilt) * this.distance;
    camera.position.set(
      this.target.x + Math.sin(this.azimuth) * horiz,
      Math.sin(this.tilt) * this.distance,
      this.target.z + Math.cos(this.azimuth) * horiz,
    );
    camera.lookAt(this.target.x, 0, this.target.z);
  }
}
