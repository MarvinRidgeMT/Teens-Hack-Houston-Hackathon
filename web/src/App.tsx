import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GlassNavbar } from './components/glass/GlassNavbar';
import { GlassDefs } from './components/glass/LiquidGlass';
import { Hero } from './sections/Hero';
import { Interrupted } from './sections/Interrupted';
import { ScrollStory } from './sections/ScrollStory';
import { ReturnDemo } from './sections/ReturnDemo';
import { Features } from './sections/Features';
import { Privacy, Evidence } from './sections/Trust';
import { Install, FinalCta, Footer } from './sections/Close';
import { useReducedMotion } from './hooks/motion';
import { useSmoothScroll } from './hooks/useSmoothScroll';

export function App() {
  const reduced = useReducedMotion();
  useSmoothScroll(reduced);

  // A deep link (#return-card) scrolls before the story's pin adds its height, so it would land
  // inside the story. Once the pin exists, measure again and go to the real target.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const go = () => { ScrollTrigger.refresh(); document.getElementById(id)?.scrollIntoView(); };
    const raf = requestAnimationFrame(() => requestAnimationFrame(go));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <GlassDefs />
      <a className="skip" href="#main">Skip to content</a>
      <GlassNavbar />
      <main id="main">
        <Hero reduced={reduced} />
        <Interrupted reduced={reduced} />
        <ScrollStory reduced={reduced} />
        <ReturnDemo reduced={reduced} />
        <Features reduced={reduced} />
        <Privacy />
        <Install />
        <Evidence />
        <FinalCta />
      </main>
      <Footer />
      <div className="grain" aria-hidden="true" />
    </MotionConfig>
  );
}
