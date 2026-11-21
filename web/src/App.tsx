import { MotionConfig } from 'motion/react';
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
