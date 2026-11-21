// Shared, non-React state between the page (GSAP ScrollTrigger, pointer) and the 3D scene.
// The scene reads it every frame from useFrame; nothing here causes React re-renders per frame.

export type Screen = 'working' | 'interrupted' | 'park' | 'return' | 'resume';
export const SCREENS: Screen[] = ['working', 'interrupted', 'park', 'return', 'resume'];

type Listener = (scene: number) => void;

export const story = {
  /** 0 → 1 across the pinned story; the camera rig interpolates poses from it. */
  progress: 0,
  /** Which scene the story is on (0..4); drives the screen texture and captions. */
  scene: 0,
  /** Pointer position in [-1, 1]; 0 without a fine pointer or under reduced motion. */
  pointerX: 0,
  pointerY: 0,
  listeners: new Set<Listener>(),
  setScene(scene: number) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.listeners.forEach((fn) => fn(scene));
  },
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  },
};
