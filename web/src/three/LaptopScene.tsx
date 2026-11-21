// The 3D stage: studio lighting built from light-formers (no HDR download), soft contact shadow,
// and a camera rig that follows the story step and, gently, the pointer.
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { Laptop } from './Laptop';
import { story } from './story';

// Pose per story step: laptop yaw/pitch and camera position / target.
const POSES = {
  hero: { x: 0.2, yaw: -0.36, pitch: 0.05, cam: [0.2, 2.3, 8.1], look: [0, 0.62, 0] },
  step: { x: 0.55, yaw: -0.14, pitch: 0.02, cam: [0, 2.1, 7.8], look: [0, 0.7, -0.3] },
  close: { x: 0.45, yaw: 0, pitch: 0, cam: [0, 1.75, 5.4], look: [0, 0.95, -0.55] },
} as const;

function poseFor(step: number) {
  if (step < 0) return POSES.hero;
  if (step === 2) return POSES.close; // the return card: come closest
  return POSES.step;
}

function Rig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(...POSES.hero.look));
  const started = useRef(0);
  const target = new THREE.Vector3();

  useEffect(() => {
    camera.position.set(...(POSES.hero.cam as [number, number, number]));
  }, [camera]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 20);
    // The opening runs on wall-clock time, so it ends in 1.6 s even on a slow GPU.
    if (!reduced && story.intro < 1) {
      if (started.current === 0) started.current = performance.now();
      story.intro = Math.min(1, (performance.now() - started.current) / 1600);
    }
    const p = poseFor(story.step);
    const k = reduced ? 1 : 1 - Math.exp(-d * 3.2);
    const introYaw = reduced ? 0 : (1 - THREE.MathUtils.smootherstep(story.intro, 0, 1)) * -0.55;
    if (group.current) {
      const yaw = p.yaw + introYaw + (reduced ? 0 : story.pointerX * 0.12);
      const pitch = p.pitch + (reduced ? 0 : story.pointerY * 0.05);
      group.current.rotation.y += (yaw - group.current.rotation.y) * k;
      group.current.rotation.x += (pitch - group.current.rotation.x) * k;
      group.current.position.x += (p.x - group.current.position.x) * k;
    }
    target.set(...(p.cam as [number, number, number]));
    camera.position.lerp(target, k);
    look.current.lerp(target.set(...(p.look as [number, number, number])), k);
    camera.lookAt(look.current);
  });

  return (
    <group ref={group} position={[0, -0.35, 0]}>
      <Laptop />
      {/* grounding: a soft neutral shadow right under the base; it moves with the laptop */}
      <ContactShadows position={[0, -0.046, 0.25]} opacity={0.42} scale={[3.5, 2.6]} blur={2.6} far={0.7} resolution={512} color="#000000" />
    </group>
  );
}

export default function LaptopScene({ reduced, onFail }: { reduced: boolean; onFail: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Stop rendering when the stage is off screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="stage-canvas" aria-hidden="true">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        shadows={false}
        camera={{ fov: 30, near: 0.1, far: 50, position: POSES.hero.cam as unknown as [number, number, number] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV }}
        onCreated={({ gl, scene }) => {
          if (import.meta.env.DEV) (window as unknown as { __scene: unknown }).__scene = scene;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail(); }, { once: true });
        }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 6, 4]} intensity={2} color="#ffffff" />
        <directionalLight position={[-5, 2, -3]} intensity={0.9} color="#a58cff" />
        <Environment resolution={256} frames={1}>
          {/* soft key */}
          <Lightformer form="rect" intensity={5} position={[0, 5, 3]} scale={[10, 5, 1]} rotation={[-Math.PI / 3, 0, 0]} />
          {/* overhead softbox behind the laptop: the deck and palm rest reflect it, so they read as silver aluminium */}
          <Lightformer form="rect" intensity={4} position={[0, 6, -6]} scale={[14, 6, 1]} rotation={[Math.PI / 4, 0, 0]} />
          <Lightformer form="rect" intensity={2.2} position={[0, 7, 1]} scale={[12, 8, 1]} rotation={[Math.PI / 2, 0, 0]} />
          {/* broad front and side softboxes: the deck stays silver at every story pose, not only the hero */}
          <Lightformer form="rect" intensity={2.4} position={[0, 2, 7]} scale={[14, 5, 1]} />
          <Lightformer form="rect" intensity={1.6} position={[-7, 2, 2]} scale={[6, 6, 1]} rotation={[0, Math.PI / 2, 0]} />
          <Lightformer form="rect" intensity={1.6} position={[7, 2, 2]} scale={[6, 6, 1]} rotation={[0, -Math.PI / 2, 0]} />
          {/* floor bounce so the aluminium reads silver, not grey */}
          <Lightformer form="rect" intensity={1.6} position={[0, -3, 2]} scale={[10, 4, 1]} rotation={[Math.PI / 2.4, 0, 0]} />
          {/* violet rim */}
          <Lightformer form="rect" intensity={2.4} color="#8a6dff" position={[-6, 1.5, -2]} scale={[3, 6, 1]} rotation={[0, Math.PI / 2.4, 0]} />
          {/* lime kicker */}
          <Lightformer form="rect" intensity={1.2} color="#c9ff38" position={[6, 0.5, 1]} scale={[2, 5, 1]} rotation={[0, -Math.PI / 2.2, 0]} />
          {/* fill */}
          <Lightformer form="ring" intensity={0.8} position={[0, 2, 8]} scale={4} />
        </Environment>
        <Rig reduced={reduced} />
      </Canvas>
    </div>
  );
}
