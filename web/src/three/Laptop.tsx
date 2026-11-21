// A procedural laptop: aluminium unibody, keyboard, trackpad, hinge, lid with bezel and display.
// Built from primitives here (no downloaded model), so there is nothing to license.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { drawScreen } from './screens';
import { story, screenForStep, type Screen } from './story';

const BASE_W = 3.04;
const BASE_D = 2.12;
const BASE_H = 0.085;
const LID_D = 2.06;
const LID_H = 0.05;
const OPEN = THREE.MathUtils.degToRad(108);

const SCREEN_W = 2.78;
const SCREEN_H = SCREEN_W / 1.6;

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
    const keys: { x: number; z: number; w: number }[] = [];
    const rows = [14, 14, 13, 12, 11];
    const pitch = 0.178;
    rows.forEach((n, r) => {
      const z = -0.86 + r * pitch;
      const rowW = n * pitch;
      for (let i = 0; i < n; i++) {
        const wide = (r === 2 && (i === 0 || i === n - 1)) || (r === 3 && (i === 0 || i === n - 1)) || (r === 4 && (i === 0 || i === n - 1));
        keys.push({ x: -rowW / 2 + i * pitch + pitch / 2, z, w: wide ? 1.25 : 1 });
      }
    });
    // space bar row
    keys.push({ x: 0, z: -0.86 + 5 * pitch, w: 5.2 });
    [-0.9, -0.72, 0.72, 0.9].forEach((x) => keys.push({ x, z: -0.86 + 5 * pitch, w: 0.95 }));
    return keys;
  }, []);

  useEffect(() => {
    const m = new THREE.Matrix4();
    layout.forEach((k, i) => {
      m.compose(new THREE.Vector3(k.x, 0, k.z), new THREE.Quaternion(), new THREE.Vector3(k.w, 1, 1));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [layout]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, layout.length]} position={[0, BASE_H / 2 + 0.006, -0.1]} castShadow>
      <boxGeometry args={[0.15, 0.012, 0.15]} />
      <meshStandardMaterial color="#17171d" roughness={0.55} metalness={0.1} />
    </instancedMesh>
  );
}

export function Laptop() {
  const root = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const front = useRef<THREE.MeshBasicMaterial>(null);
  const back = useRef<THREE.MeshBasicMaterial>(null);
  const textures = useScreenTextures();
  const shown = useRef<Screen | null>(null);
  const fade = useRef(1);

  const aluminium = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#dfe1e8', metalness: 0.88, roughness: 0.28, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    [],
  );
  const darkGlass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0b0b10', roughness: 0.12, metalness: 0.2, clearcoat: 1 }), []);

  useFrame((_, dt) => {
    // lid opens with the intro
    const t = THREE.MathUtils.smootherstep(story.intro, 0, 1);
    if (lid.current) lid.current.rotation.x = -OPEN * (0.08 + 0.92 * t) + Math.PI;

    // screen cross-fade when the story step changes
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

  return (
    <group ref={root} position={[0, 0, 0.25]}>
      {/* base */}
      <RoundedBox args={[BASE_W, BASE_H, BASE_D]} radius={0.035} smoothness={4} material={aluminium} castShadow receiveShadow />
      {/* keyboard well */}
      <mesh position={[0, BASE_H / 2 + 0.0005, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.62, 1.12]} />
        <meshStandardMaterial color="#c6c9d2" metalness={0.75} roughness={0.38} />
      </mesh>
      <Keyboard />
      {/* trackpad */}
      <mesh position={[0, BASE_H / 2 + 0.0008, 0.66]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.18, 0.66]} />
        <meshPhysicalMaterial color="#c3c6cf" metalness={0.7} roughness={0.22} clearcoat={0.6} />
      </mesh>
      {/* hinge */}
      <mesh position={[0, BASE_H / 2, -BASE_D / 2 + 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 2.5, 24]} />
        <meshStandardMaterial color="#3a3b44" metalness={0.8} roughness={0.35} />
      </mesh>

      {/* lid: pivots on the back edge */}
      <group ref={lid} position={[0, BASE_H / 2 + 0.02, -BASE_D / 2 + 0.03]}>
        <group position={[0, 0, -LID_D / 2]}>
          <RoundedBox args={[BASE_W, LID_H, LID_D]} radius={0.02} smoothness={4} material={aluminium} castShadow />
          {/* bezel (glass) on the inner face */}
          <mesh position={[0, LID_H / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={darkGlass}>
            <planeGeometry args={[BASE_W - 0.06, LID_D - 0.06]} />
          </mesh>
          {/* display: two stacked layers so a new screen can fade in over the last */}
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
