// Shared, non-React state between the page (GSAP ScrollTrigger, pointer) and the 3D scene.
// The scene reads it every frame; nothing here causes React re-renders.

export type Screen = 'card' | 'leave' | 'drift' | 'resume';

export const STEP_SCREENS: Screen[] = ['leave', 'drift', 'card', 'resume'];

type Listener = (step: number) => void;

export const story = {
  /** -1 = hero pose; 0..3 = walkthrough steps (Leave, Drift, Return, Resume). */
  step: -1,
  /** Pointer position in [-1, 1], 0 when there is no fine pointer. */
  pointerX: 0,
  pointerY: 0,
  /** 0 → 1 as the opening sequence plays (set to 1 at once under reduced motion). */
  intro: 0,
  listeners: new Set<Listener>(),
  setStep(step: number) {
    if (step === this.step) return;
    this.step = step;
    this.listeners.forEach((fn) => fn(step));
  },
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  },
};

export function screenForStep(step: number): Screen {
  return step < 0 ? 'card' : STEP_SCREENS[Math.min(step, STEP_SCREENS.length - 1)];
}
