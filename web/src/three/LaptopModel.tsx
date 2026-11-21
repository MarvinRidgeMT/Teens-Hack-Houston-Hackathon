// The Blender-built laptop (web/three-src/laptop/build_laptop.py, own work, CC0).
// Loads the meshopt-compressed GLB, swaps every material by name for tuned PBR materials,
// shows an optional screen texture, and opens the lid about its hinge axis.
// drei 10.7's useGLTF uses three-stdlib's MeshoptDecoder (wasm bundled in JS), so no CDN fetch.
import { useLayoutEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = 'assets/laptop/laptop.glb';

/** Lid angle at open = 1, in radians (the GLB's Lid origin sits exactly on the hinge axis). */
export const LAPTOP_OPEN_ANGLE = THREE.MathUtils.degToRad(112);

/** Model size in its own units (1 unit = 10 cm): base footprint and thickness. */
export const LAPTOP_SIZE = { width: 3.12, depth: 2.21, baseHeight: 0.15 } as const;

export function preloadLaptop() {
  useGLTF.preload(MODEL_URL, false, true);
}

type Materials = Record<string, THREE.Material>;

function makeMaterials(): Materials {
  const aluminium = new THREE.MeshPhysicalMaterial({
    color: '#dcdee3',
    metalness: 1,
    roughness: 0.26,
    envMapIntensity: 1.35,
  });
  return {
    M_Aluminium: aluminium,
    M_Hinge: new THREE.MeshPhysicalMaterial({ color: '#a7a8ae', metalness: 1, roughness: 0.4 }),
    // Basic, so no light or pose can lift the bezel to grey.
    M_Bezel: new THREE.MeshBasicMaterial({ color: '#050507' }),
    M_Screen: new THREE.MeshBasicMaterial({ color: '#0b0b10', toneMapped: false }),
    M_Glass: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
    }),
    M_Keys: new THREE.MeshStandardMaterial({ color: '#18181c', metalness: 0, roughness: 0.62, envMapIntensity: 0.35 }),
    M_Well: new THREE.MeshPhysicalMaterial({ color: '#8c8d93', metalness: 1, roughness: 0.46 }),
    M_Trackpad: new THREE.MeshPhysicalMaterial({ color: '#dcdde2', metalness: 1, roughness: 0.26, envMapIntensity: 1.3 }),
    M_Rubber: new THREE.MeshStandardMaterial({ color: '#26262b', metalness: 0, roughness: 0.85 }),
  };
}

type GroupProps = ThreeElements['group'];

export type LaptopModelProps = Omit<GroupProps, 'children'> & {
  /** Texture shown on the display (e.g. a CanvasTexture). Upright with the default flipY = true. */
  screen?: THREE.Texture | null;
  /** 0 = closed, 1 = fully open (112 degrees). Ignored while `openRef` is given. */
  open?: number;
  /** Read every frame, so scroll-driven code can animate the lid without re-rendering React. */
  openRef?: MutableRefObject<number>;
};

export function LaptopModel({ screen = null, open = 1, openRef, ...group }: LaptopModelProps) {
  const gltf = useGLTF(MODEL_URL, false, true);
  const materials = useMemo(makeMaterials, []);

  // Own copy of the scene graph (geometry stays shared with the cache) with our materials on it.
  const { root, lid } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material | undefined)?.name ?? '';
      const next = materials[name];
      if (next) mesh.material = next;
      mesh.castShadow = mesh.name !== 'ScreenGlass';
      mesh.receiveShadow = true;
      if (mesh.name === 'ScreenGlass') mesh.renderOrder = 2;
    });
    const lidNode = clone.getObjectByName('Lid');
    if (!lidNode) throw new Error('laptop.glb has no Lid node');
    return { root: clone, lid: lidNode };
  }, [gltf.scene, materials]);

  // Screen texture: a basic material map, never tone mapped, so the UI keeps its true colours.
  useLayoutEffect(() => {
    const mat = materials.M_Screen as THREE.MeshBasicMaterial;
    if (screen) screen.colorSpace = THREE.SRGBColorSpace;
    mat.map = screen;
    mat.color.set(screen ? '#ffffff' : '#0b0b10');
    mat.needsUpdate = true;
  }, [screen, materials]);

  // Dispose the materials made for this instance (geometry belongs to the GLTF cache).
  useLayoutEffect(
    () => () => {
      for (const m of Object.values(materials)) m.dispose();
    },
    [materials],
  );

  // R3F keeps the latest closure, so `open` here is always the current prop.
  useFrame(() => {
    const raw = openRef ? openRef.current : open;
    const t = THREE.MathUtils.clamp(Number.isFinite(raw) ? raw : 0, 0, 1);
    lid.rotation.x = -LAPTOP_OPEN_ANGLE * t;
  });

  // Set the pose before the first paint too (useFrame runs only once the loop ticks).
  useLayoutEffect(() => {
    const raw = openRef ? openRef.current : open;
    lid.rotation.x = -LAPTOP_OPEN_ANGLE * THREE.MathUtils.clamp(raw, 0, 1);
  }, [lid, open, openRef]);

  return (
    <group {...group}>
      <primitive object={root} />
    </group>
  );
}

export default LaptopModel;
