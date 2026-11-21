// Camera poses for the laptop, and a fit step that keeps the whole laptop inside the canvas at
// any aspect ratio. Poses are tuned by eye; fitCamera only ever moves the camera back.
import * as THREE from 'three';

export type Pose = { x: number; y: number; yaw: number; pitch: number; cam: [number, number, number]; look: [number, number, number] };

/** Hero first, then one pose per story scene (working, interrupted, park, return, resume). */
export const HERO_POSE: Pose = { x: 0.1, y: 0, yaw: -0.5, pitch: 0.06, cam: [0.3, 2.6, 9.4], look: [0, 0.8, 0] };
export const STORY_POSES: Pose[] = [
  { x: 0.05, y: 0, yaw: -0.3, pitch: 0.04, cam: [0.2, 2.5, 9.0], look: [0, 0.85, 0] },     // working
  { x: 0.08, y: -0.05, yaw: -0.42, pitch: 0.06, cam: [0.4, 2.9, 10.2], look: [0, 0.8, 0] }, // interrupted: steps back
  { x: 0.04, y: 0, yaw: -0.18, pitch: 0.03, cam: [0.1, 2.4, 8.4], look: [0, 0.95, -0.4] },   // park
  { x: 0, y: 0, yaw: 0, pitch: 0, cam: [0, 2.05, 6.6], look: [0, 1.05, -0.9] },              // return: up to the screen
  { x: 0.03, y: 0, yaw: -0.12, pitch: 0.02, cam: [0.1, 2.3, 8.2], look: [0, 0.95, -0.4] },   // resume: settles
];

/** Outer corners of the open laptop (base footprint + top of the lid), in the model's space.
 *  Replaced by the real bounding box once the model loads (setHull). */
let HULL: THREE.Vector3[] = [];
export function setHull(box: THREE.Box3) {
  const { min, max } = box;
  HULL = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) HULL.push(new THREE.Vector3(x, y, z));
}
setHull(new THREE.Box3(new THREE.Vector3(-1.56, 0, -1.95), new THREE.Vector3(1.56, 2.2, 1.11)));

export type Margin = { left: number; right: number; top: number; bottom: number };

/** Camera position for a pose, dollied back until every hull corner (with pointer sway) clears the margins. */
export function fitCamera(p: Pose, width: number, height: number, fov: number, margin: Margin): THREE.Vector3 {
  const look = new THREE.Vector3(...p.look);
  const cam = new THREE.Vector3(...p.cam);
  if (width < 1 || height < 1 || !HULL.length) return cam;
  const probe = new THREE.PerspectiveCamera(fov, width / height, 0.1, 60);
  const lim = {
    left: -1 + (2 * margin.left) / width,
    right: 1 - (2 * margin.right) / width,
    top: 1 - (2 * margin.top) / height,
    bottom: -1 + (2 * margin.bottom) / height,
  };
  const corners: THREE.Vector3[] = [];
  for (const sway of [-0.07, 0, 0.07]) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, p.y, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch, p.yaw + sway, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    HULL.forEach((v) => corners.push(v.clone().applyMatrix4(m)));
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    probe.position.copy(cam);
    probe.lookAt(look);
    probe.updateMatrixWorld();
    let over = 1;
    for (const c of corners) {
      v.copy(c).project(probe);
      over = Math.max(over, v.x / lim.right, v.x / lim.left, v.y / lim.top, v.y / lim.bottom);
    }
    if (over <= 1.001) break;
    cam.sub(look).multiplyScalar(over * 1.01).add(look);
  }
  return cam;
}

/** Linear blend of two poses (t in 0..1), eased by the caller. */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    x: l(a.x, b.x), y: l(a.y, b.y), yaw: l(a.yaw, b.yaw), pitch: l(a.pitch, b.pitch),
    cam: [l(a.cam[0], b.cam[0]), l(a.cam[1], b.cam[1]), l(a.cam[2], b.cam[2])],
    look: [l(a.look[0], b.look[0]), l(a.look[1], b.look[1]), l(a.look[2], b.look[2])],
  };
}
