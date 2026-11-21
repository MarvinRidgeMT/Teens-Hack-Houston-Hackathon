import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth wheel scrolling, driven by GSAP's ticker so ScrollTrigger and Lenis read the
 * same position on the same frame (one loop, not two). Off under reduced motion; keyboard,
 * anchors, find-in-page and history keep working (Lenis only smooths wheel/touchpad input).
 */
export function useSmoothScroll(reduced: boolean) {
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ autoRaf: false, anchors: { offset: 0 }, lerp: 0.12 });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, [reduced]);
}
