import { MotionConfig } from 'motion/react';
import { Nav } from './components/Nav';
import { Story } from './sections/Story';
import { TryIt } from './sections/TryIt';
import { Features } from './sections/Features';
import { Privacy, Evidence } from './sections/Trust';
import { Demo, Install, Footer } from './sections/Close';
import { useReducedMotion } from './hooks/motion';
import { useSmoothScroll } from './hooks/useSmoothScroll';

export function App() {
  const reduced = useReducedMotion();
  useSmoothScroll(reduced);
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip" href="#main">Skip to content</a>
      <Nav />
      <main id="main">
        <Story reduced={reduced} />
        <TryIt reduced={reduced} />
        <Features reduced={reduced} />
        <Privacy />
        <Evidence />
        <Demo />
        <Install />
      </main>
      <Footer />
    </MotionConfig>
  );
}
