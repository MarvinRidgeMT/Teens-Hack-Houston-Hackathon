// A procedural laptop: aluminium unibody, a recessed keyboard well with keys on a real laptop grid,
// one continuous palm rest, an inset trackpad, hinge, and a lid with glass bezel and display.
// Built from primitives here (no downloaded model), so there is nothing to license.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { drawScreen } from './screens';
import { story, screenForStep, type Screen } from './story';

const BASE_W = 3.04;
const BASE_D = 2.12;
const BASE_H = 0.085;
const LID_D = 2.06;
const LID_H = 0.05;
const OPEN = THREE.MathUtils.degToRad(108);
const TOP = BASE_H / 2;

const SCREEN_W = 2.78;
const SCREEN_H = SCREEN_W / 1.6;

// Keyboard: every row adds up to 14.5 key units, so both edges are flush like a real board.
const U = 0.172;          // key pitch
const GAP = 0.026;        // gap between caps
const KB_Z = -0.88;       // first row (function keys)
const ROWS: { h: number; keys: number[] }[] = [
  { h: 0.55, keys: Array(14).fill(14.5 / 14) },
  { h: 1, keys: [...Array(13).fill(1), 1.5] },
  { h: 1, keys: [1.5, ...Array(13).fill(1)] },
  { h: 1, keys: [1.75, ...Array(11).fill(1), 1.75] },
  { h: 1, keys: [2.25, ...Array(10).fill(1), 2.25] },
  { h: 1, keys: [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1] },
];
const KB_W = 14.5 * U;
const KB_D = ROWS.reduce((sum, r) => sum + r.h, 0) * U;

function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 8);
}

function useScreenTextures() {
  const textures = useRef(new Map<Screen, THREE.CanvasTexture>());
  useEffect(() => {
    let alive = true;
    (['card', 'leave', 'drift', 'resume'] as Screen[]).forEach(async (s) => {
      const canvas = await drawScreen(s).catch(() => null);
      if (!canvas || !alive) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      textures.current.set(s, tex);
    });
    return () => {
      alive = false;
      textures.current.forEach((t) => t.dispose());
      textures.current.clear();
    };
  }, []);
  return textures;
}

function Keyboard() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const layout = useMemo(() => {
    const keys: { x: number; z: number; w: number; d: number }[] = [];
    let z = KB_Z;
    ROWS.forEach((row, r) => {
      const depth = row.h * U;
      const zc = z + depth / 2;
      let x = -KB_W / 2;
      row.keys.forEach((units, i) => {
        const w = units * U;
        if (r === 5 && i >= 7) {
          // the arrow cluster: left and right are half height; up and down share a stacked slot
          if (i === 8) {
            keys.push({ x: x + w / 2, z: zc - depth / 4, w: w - GAP, d: depth / 2 - GAP / 1.5 });
            keys.push({ x: x + w / 2, z: zc + depth / 4, w: w - GAP, d: depth / 2 - GAP / 1.5 });
          } else {
            keys.push({ x: x + w / 2, z: zc + depth / 4, w: w - GAP, d: depth / 2 - GAP / 1.5 });
          }
        } else {
          keys.push({ x: x + w / 2, z: zc, w: w - GAP, d: depth - GAP });
        }
        x += w;
      });
      z += depth;
    });
    return keys;
  }, []);

  const geometry = useMemo(() => new RoundedBoxGeometry(1, 0.018, 1, 2, 0.006), []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    layout.forEach((k, i) => {
      m.compose(new THREE.Vector3(k.x, 0, k.z), q, new THREE.Vector3(k.w, 1, k.d));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [layout]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, layout.length]} position={[0, TOP + 0.004, 0]}>
      <meshStandardMaterial color="#141418" roughness={0.62} metalness={0.05} />
    </instancedMesh>
  );
}

export function Laptop() {
  const lid = useRef<THREE.Group>(null);
  const front = useRef<THREE.MeshBasicMaterial>(null);
  const back = useRef<THREE.MeshBasicMaterial>(null);
  const textures = useScreenTextures();
  const shown = useRef<Screen | null>(null);
  const fade = useRef(1);

  const aluminium = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#dcdee5', metalness: 1, roughness: 0.34, clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 1.15 }),
    [],
  );
  const darkGlass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#08080c', roughness: 0.08, metalness: 0.1, clearcoat: 1 }), []);
  const wellGeo = useMemo(() => roundedRect(KB_W + 0.1, KB_D + 0.1, 0.05), []);
  const padRim = useMemo(() => roundedRect(1.3, 0.8, 0.07), []);
  const pad = useMemo(() => roundedRect(1.28, 0.78, 0.065), []);
  useEffect(() => () => { [aluminium, darkGlass, wellGeo, padRim, pad].forEach((o) => o.dispose()); }, [aluminium, darkGlass, wellGeo, padRim, pad]);

  useFrame((_, dt) => {
    const t = THREE.MathUtils.smootherstep(story.intro, 0, 1);
    if (lid.current) lid.current.rotation.x = -OPEN * (0.08 + 0.92 * t) + Math.PI;

    const want = screenForStep(story.step);
    const tex = textures.current.get(want);
    if (tex && front.current && back.current) {
      if (shown.current !== want) {
        // move the current image to the back layer and fade the new one in on top
        back.current.map = front.current.map;
        back.current.needsUpdate = true;
        front.current.map = tex;
        front.current.needsUpdate = true;
        fade.current = shown.current === null ? 1 : 0;
        shown.current = want;
      }
      fade.current = Math.min(1, fade.current + dt * 3.2);
      front.current.opacity = fade.current;
      front.current.color.setScalar(t > 0.6 ? 1 : 0.25 + t);
    }
  });

  const kbCenterZ = KB_Z + KB_D / 2;

  return (
    <group position={[0, 0, 0.25]}>
      {/* unibody base: one continuous aluminium deck and palm rest */}
      <RoundedBox args={[BASE_W, BASE_H, BASE_D]} radius={0.035} smoothness={5} material={aluminium} />
      {/* keyboard well: a dark recess cut tight around the keys */}
      <mesh geometry={wellGeo} position={[0, TOP + 0.0008, kbCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#1b1c21" roughness={0.75} metalness={0.2} />
      </mesh>
      <Keyboard />
      {/* trackpad: a fine darker rim, then a smoother inset surface */}
      <mesh geometry={padRim} position={[0, TOP + 0.0006, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#9da0aa" metalness={0.9} roughness={0.4} />
      </mesh>
      <mesh geometry={pad} position={[0, TOP + 0.0009, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshPhysicalMaterial color="#cfd2da" metalness={0.85} roughness={0.2} clearcoat={0.5} clearcoatRoughness={0.3} />
      </mesh>
      {/* hinge */}
      <mesh position={[0, TOP, -BASE_D / 2 + 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 2.5, 32]} />
        <meshStandardMaterial color="#2c2d34" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* lid: pivots on the back edge */}
      <group ref={lid} position={[0, TOP + 0.02, -BASE_D / 2 + 0.03]}>
        <group position={[0, 0, -LID_D / 2]}>
          <RoundedBox args={[BASE_W, LID_H, LID_D]} radius={0.02} smoothness={5} material={aluminium} />
          <mesh position={[0, LID_H / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={darkGlass}>
            <planeGeometry args={[BASE_W - 0.05, LID_D - 0.05]} />
          </mesh>
          {/* display: two stacked layers so a new screen fades in over the last */}
          <mesh position={[0, LID_H / 2 + 0.004, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            <meshBasicMaterial ref={back} toneMapped={false} color="#ffffff" />
          </mesh>
          <mesh position={[0, LID_H / 2 + 0.005, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            <meshBasicMaterial ref={front} toneMapped={false} transparent color="#ffffff" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
