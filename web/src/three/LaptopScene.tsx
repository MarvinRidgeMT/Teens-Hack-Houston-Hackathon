// The 3D stage: a product-photography studio built from Lightformers (no HDR download), a soft
// lavender contact shadow, adaptive quality, and a camera rig. mode="hero" holds the hero pose and
// plays the opening (lid opens, laptop settles); mode="story" follows story.progress from ScrollTrigger.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, ContactShadows, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { LaptopModel } from './LaptopModel';
import { story, SCREENS, type Screen } from './story';
import { drawScreen } from './screens';
import { HERO_POSE, STORY_POSES, blendPose, fitCamera, type Margin, type Pose } from './rig';

type Mode = 'hero' | 'story';
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const FOV = 28;

function useScreens() {
  const [tex, setTex] = useState<Partial<Record<Screen, THREE.Texture>>>({});
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let alive = true;
    const made: THREE.Texture[] = [];
    SCREENS.forEach(async (s) => {
      try {
        const canvas = await drawScreen(s);
        if (!alive) return;
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = gl.capabilities.getMaxAnisotropy();
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        made.push(t);
        setTex((cur) => ({ ...cur, [s]: t }));
      } catch (err) {
        console.error(err);
      }
    });
    return () => { alive = false; made.forEach((t) => t.dispose()); };
  }, [gl]);
  return tex;
}

function Rig({ mode, reduced, margin }: { mode: Mode; reduced: boolean; margin: Margin }) {
  const group = useRef<THREE.Group>(null);
  const open = useRef(reduced ? 1 : 0);
  const { camera, size } = useThree();
  const screens = useScreens();
  const [scene, setScene] = useState(mode === 'hero' ? 3 : story.scene);
  const look = useRef(new THREE.Vector3(...HERO_POSE.look));
  const started = useRef(0);

  useEffect(() => (mode === 'story' ? story.subscribe(setScene) : undefined), [mode]);

  // Fitted camera per pose, recomputed only when the canvas size changes.
  const fitted = useMemo(() => {
    const fit = (p: Pose): Pose => ({ ...p, cam: fitCamera(p, size.width, size.height, FOV, margin).toArray() as Pose['cam'] });
    return { hero: fit(HERO_POSE), story: STORY_POSES.map(fit) };
  }, [size.width, size.height, margin]);

  useEffect(() => {
    const p = mode === 'hero' ? fitted.hero : fitted.story[0];
    camera.position.set(...p.cam);
    look.current.set(...p.look);
    // the first frame only; later frames ease toward the pose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  const shown = screens[SCREENS[scene]] ?? null;
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 20);
    // Opening on wall-clock time (ends in ~1.4 s even on a slow GPU): the lid opens and the laptop settles.
    if (!reduced && open.current < 1) {
      if (!started.current) started.current = performance.now();
      const t = Math.min(1, (performance.now() - started.current) / 1400);
      open.current = THREE.MathUtils.smootherstep(t, 0, 1);
    }
    let p: Pose;
    if (mode === 'hero') p = fitted.hero;
    else {
      const s = THREE.MathUtils.clamp(story.progress, 0, 1) * (fitted.story.length - 1);
      const i = Math.min(Math.floor(s), fitted.story.length - 2);
      p = blendPose(fitted.story[i], fitted.story[i + 1], THREE.MathUtils.smootherstep(s - i, 0, 1));
    }
    const k = reduced ? 1 : 1 - Math.exp(-d * 4);
    const g = group.current;
    if (g) {
      const settle = reduced ? 0 : (1 - open.current) * -0.35;
      const yaw = p.yaw + (reduced ? 0 : story.pointerX * 0.06);
      const pitch = p.pitch + (reduced ? 0 : story.pointerY * 0.035);
      g.rotation.y += (yaw - g.rotation.y) * k;
      g.rotation.x += (pitch - g.rotation.x) * k;
      g.position.x += (p.x - g.position.x) * k;
      g.position.y += (p.y + settle - g.position.y) * k;
    }
    camera.position.lerp(target.set(...p.cam), k);
    look.current.lerp(target.set(...p.look), k);
    camera.lookAt(look.current);
  });

  return (
    <group ref={group}>
      <LaptopModel screen={shown} openRef={open} />
      <ContactShadows position={[0, -0.002, 0]} opacity={0.42} scale={9} blur={2.6} far={1.2} resolution={512} color={css('--plum')} />
    </group>
  );
}

function Studio() {
  const c = useMemo(() => ({ lav: css('--lavender'), mint: css('--mint'), blush: css('--blush'), white: css('--surface-elevated') }), []);
  return (
    <>
      <ambientLight intensity={0.3} color={c.lav} />
      <directionalLight position={[-4, 7, 5]} intensity={1.6} color={c.white} />
      <Environment resolution={256} frames={1}>
        {/* large soft key, top-left, white */}
        <Lightformer form="rect" intensity={5.5} color={c.white} position={[-4, 6, 4]} scale={[9, 6, 1]} rotation={[-Math.PI / 3, -Math.PI / 8, 0]} />
        {/* overhead softbox: the deck reads as silver */}
        <Lightformer form="rect" intensity={3} color={c.white} position={[0, 7, -2]} scale={[14, 8, 1]} rotation={[Math.PI / 2, 0, 0]} />
        {/* fill, front-right, lavender, low */}
        <Lightformer form="rect" intensity={1.6} color={c.lav} position={[6, 2, 6]} scale={[8, 6, 1]} rotation={[0, -Math.PI / 4, 0]} />
        {/* rim strip, back-right, narrow white: outlines lid and base edges */}
        <Lightformer form="rect" intensity={7} color={c.white} position={[5, 3, -5]} scale={[1.2, 9, 1]} rotation={[0, -Math.PI * 0.75, 0]} />
        {/* mint bounce card, bottom-left */}
        <Lightformer form="rect" intensity={2.2} color={c.mint} position={[-5, -2, 3]} scale={[7, 4, 1]} rotation={[Math.PI / 3, Math.PI / 4, 0]} />
        {/* blush accent card, right, low */}
        <Lightformer form="rect" intensity={1.4} color={c.blush} position={[7, 0.5, 0]} scale={[3, 5, 1]} rotation={[0, -Math.PI / 2, 0]} />
      </Environment>
    </>
  );
}

export default function LaptopScene({ mode, reduced, onFail, margin }: {
  mode: Mode; reduced: boolean; onFail: () => void; margin: Margin;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [dpr, setDpr] = useState(1.75);

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
        dpr={[1, dpr]}
        camera={{ fov: FOV, near: 0.1, far: 60, position: HERO_POSE.cam }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV }}
        onCreated={({ gl, scene }) => {
          if (import.meta.env.DEV) (window as unknown as Record<string, unknown>)[`__scene_${mode}`] = scene;
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail(); }, { once: true });
        }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1.1)} onIncline={() => setDpr(1.75)} />
        <AdaptiveDpr pixelated={false} />
        <Studio />
        <Suspense fallback={null}>
          <Rig mode={mode} reduced={reduced} margin={margin} />
        </Suspense>
      </Canvas>
    </div>
  );
}
