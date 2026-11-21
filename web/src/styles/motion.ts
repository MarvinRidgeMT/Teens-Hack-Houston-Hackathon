// The motion vocabulary (mirrors the --dur-* / --ease-* custom properties in tokens.css).
// Ownership: GSAP = timelines, ScrollTrigger, camera, text reveal. Motion = UI springs, layout,
// presence, gestures. Lenis = scroll. R3F = rendering. CSS = simple state transitions.
// Never animate the same property on the same element with two of them.

export const DUR = {
  pointer: 0.14,
  hover: 0.2,
  press: 0.14,
  tooltip: 0.2,
  card: 0.4,
  nav: 0.36,
  modal: 0.36,
} as const;

/** Tactile controls: buttons, gel press, nav droplet. */
export const SPRING_PRESS = { type: 'spring' as const, stiffness: 520, damping: 28, mass: 0.9 };
/** Cards and panels changing state. */
export const SPRING_CARD = { type: 'spring' as const, stiffness: 300, damping: 30 };
/** The nav droplet: a little give on travel, settles without wobble. */
export const SPRING_DROPLET = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.8 };

/** GSAP eases for cinematic moves. */
export const EASE = {
  enter: 'power3.out',
  hero: 'expo.out',
  drift: 'sine.inOut',
} as const;

export const INSTANT = { duration: 0 } as const;
