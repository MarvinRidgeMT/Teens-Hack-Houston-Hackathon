// TEMPORARY stand-in with the same props as the Blender model's loader (lane L replaces this file).
import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const OPEN = THREE.MathUtils.degToRad(112);

export function LaptopModel({ screen, openRef }: { screen?: THREE.Texture | null; open?: number; openRef?: MutableRefObject<number> }) {
  const lid = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = openRef?.current ?? 1;
    if (lid.current) lid.current.rotation.x = -(OPEN * t);
  });
  return (
    <group>
      <RoundedBox args={[3.12, 0.15, 2.21]} radius={0.05} position={[0, 0.075, 0]}>
        <meshPhysicalMaterial color="silver" metalness={1} roughness={0.35} />
      </RoundedBox>
      <group ref={lid} position={[0, 0.15, -1.1]}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <RoundedBox args={[3.12, 0.055, 2.1]} radius={0.02} position={[0, 0, -1.05]}>
            <meshPhysicalMaterial color="silver" metalness={1} roughness={0.35} />
          </RoundedBox>
          <mesh position={[0, -0.03, -1.05]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.9, 1.8125]} />
            <meshBasicMaterial map={screen ?? null} toneMapped={false} color={screen ? 'white' : 'black'} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
