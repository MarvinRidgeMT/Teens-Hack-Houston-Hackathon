import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { CornerDownLeft, RotateCcw, Undo2 } from 'lucide-react';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import { GlassButton } from '../components/glass/GlassButton';
import { SectionHead } from '../components/ui';
import { SPRING_CARD, SPRING_PRESS } from '../styles/motion';

type State = 'card' | 'resumed' | 'dismissed';
const ESSAY = [
  'Droughts in the region have grown longer over the past two decades, and towns that once refilled every spring now stay low into the summer.',
  "Rainfall has been below average since 2023, and the state's reservoirs were at about half of their usual level by the end of last summer.",
  'Some farmers have already switched to crops that need less water, such as sorghum instead of corn.',
];

/** Section 4: the Return card, big enough to read, with its three real actions simulated. */
export function ReturnDemo({ reduced }: { reduced: boolean }) {
  const [state, setState] = useState<State>('card');
  const [tidied, setTidied] = useState(false);
  const resume = useRef<HTMLButtonElement>(null);
  const again = useRef<HTMLSpanElement>(null);
  const t = reduced ? { duration: 0 } : SPRING_CARD;

  // Focus follows the demo: back to Resume when the card returns, to "Show the card again" when it closes.
  const wasInside = useRef(false);
  useEffect(() => {
    if (!wasInside.current) return;
    if (state === 'card') resume.current?.focus();
    else again.current?.querySelector('button')?.focus();
  }, [state]);
  const track = () => { wasInside.current = !!document.activeElement?.closest('.rdemo-sec'); };

  // Keys work only while focus is inside the card, like the real one (it never steals page keys).
  const keys = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLButtonElement && e.key === 'Enter') return; // the focused button handles Enter itself
    if (e.key === 'Enter') { e.preventDefault(); setState('resumed'); }
    else if (e.key.toLowerCase() === 't') { e.preventDefault(); setTidied(true); }
    else if (e.key === 'Escape') { e.preventDefault(); setState('dismissed'); }
  };

  const status = state === 'resumed' ? 'Resumed: back at the highlighted sentence, scroll restored.'
    : state === 'dismissed' ? 'Card closed. Your place is still saved; Alt+R takes you back from any tab.'
    : tidied ? 'Tidied: the video tab moved into a collapsed "Later" group. Nothing was closed.' : 'Return card open.';

  return (
    <section className="section rdemo-sec" id="return-card" aria-labelledby="rd-title">
      <div className="atmo" aria-hidden="true">
        <span className="atmo__light atmo__light--lilac" style={{ width: '56vw', height: '56vw', left: '18vw', top: '-8vw' }} />
        <span className="atmo__light atmo__light--mint" style={{ width: '30vw', height: '30vw', left: '-6vw', bottom: '-4vw' }} />
      </div>
      <div className="wrap">
        <SectionHead id="rd-title" align="center" title="Every line is something you did or wrote."
          lede="This is the card Pickup shows when you come back to a work page. Press its buttons, or focus it and use Enter, T and Esc. A demo on this page; it doesn't touch your browser." />

        <div className="rdemo">
          <div className="rdemo__tabs" aria-label="Simulated tabs">
            <LayoutGroup>
              <motion.span layout transition={t} className="bf__group">Climate Essay</motion.span>
              <motion.span layout transition={t} className="bf__tab is-active is-group">Climate essay: draft</motion.span>
              <motion.span layout transition={t} className="bf__tab is-group">Reservoir levels 2023</motion.span>
              <motion.span layout transition={t} className="bf__tab is-group">Drought statistics</motion.span>
              {!tidied && <motion.span layout key="vid" transition={t} className="bf__tab">Video: lo-fi beats</motion.span>}
              {tidied && <motion.span layout key="later" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={reduced ? { duration: 0 } : SPRING_PRESS} className="bf__tab is-later">Later (1)</motion.span>}
            </LayoutGroup>
          </div>
          <div className="rdemo__page">
            {ESSAY.map((p, i) => (
              <p key={i} className={i === 1 && state === 'resumed' ? 'rdemo__hl is-on' : i === 1 ? 'rdemo__hl' : ''}>{p}</p>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {state === 'card' && (
              <motion.div key="card" className="rdemo__card-wrap" initial={{ opacity: 0, y: -14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={t}>
                <LiquidGlass as="section" variant="crystal" radius="36px 36px 36px 22px" text interactive className="rcard"
                  role="dialog" aria-labelledby="rcard-t" aria-describedby="rcard-next" onKeyDown={(e) => { track(); keys(e); }} onClickCapture={track}>
                  <p className="rcard__meta tnum"><span className="rcard__dot" aria-hidden="true" />Pickup · away 12 min</p>
                  <h3 id="rcard-t" className="rcard__title">Welcome back to <span className="rcard__task">Climate Essay</span></h3>
                  <div className="rcard__next" id="rcard-next">
                    <p className="label">Your next step · you wrote this</p>
                    <p className="rcard__next-text">Find a source for the 2023 rainfall number</p>
                  </div>
                  <dl className="rcard__ctx">
                    <div><dt>Highlight</dt><dd>“Rainfall has been below average since 2023”</dd></div>
                    <div><dt>Spot</dt><dd>Scroll position saved</dd></div>
                    <div><dt>Tabs</dt><dd>3 in the task group{tidied ? ' · 1 in Later' : ' · 1 opened on your break'}</dd></div>
                  </dl>
                  <div className="rcard__actions">
                    <button ref={resume} type="button" className="rcard__resume" onClick={() => setState('resumed')}>
                      Resume <kbd><CornerDownLeft size={13} aria-label="Enter" /></kbd>
                    </button>
                    <button type="button" className="rcard__quiet" onClick={() => setTidied(true)} aria-disabled={tidied}>
                      {tidied ? 'Tidied into Later' : <>Tidy distraction tabs? <kbd>T</kbd></>}
                    </button>
                    <button type="button" className="rcard__quiet" onClick={() => setState('dismissed')}>Not now <kbd>Esc</kbd></button>
                  </div>
                </LiquidGlass>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="rdemo__status">
          <p role="status">{status}</p>
          {tidied && state === 'card' && <GlassButton tone="quiet" onClick={() => setTidied(false)} icon={<Undo2 size={15} />}>Undo tidy</GlassButton>}
          {state !== 'card' && <span ref={again}><GlassButton tone="pearl" onClick={() => { track(); setState('card'); setTidied(false); }} icon={<RotateCcw size={15} />}>Show the card again</GlassButton></span>}
        </div>
      </div>
    </section>
  );
}
