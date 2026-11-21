import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Play, RotateCcw } from 'lucide-react';
import { BrowserFrame, type BrowserTab } from '../components/BrowserFrame';
import { GlassButton } from '../components/glass/GlassButton';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import { SectionHead } from '../components/ui';
import { SPRING_CARD } from '../styles/motion';

type Phase = 'working' | 'away' | 'back';

const BASE: BrowserTab[] = [
  { id: 'essay', title: 'Climate essay: draft', group: true },
  { id: 'res', title: 'Reservoir levels 2023', group: true },
  { id: 'stats', title: 'Drought statistics', group: true },
];

/** A small, clearly labelled simulation: get distracted, come back, see what was kept. */
export function Interrupted({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState<Phase>('working');
  const t = reduced ? { duration: 0 } : SPRING_CARD;
  const tabs: BrowserTab[] = phase === 'working' ? BASE : [...BASE, { id: 'vid', title: 'Video: lo-fi beats' }];
  const active = phase === 'away' ? 'vid' : 'essay';

  return (
    <section className="section interrupted" id="interrupted" aria-labelledby="int-title">
      <div className="atmo" aria-hidden="true">
        <span className="atmo__light atmo__light--blush" style={{ width: '40vw', height: '40vw', right: '-10vw', top: '10%' }} />
        <span className="atmo__light atmo__light--lilac" style={{ width: '36vw', height: '36vw', left: '-12vw', bottom: '-10%' }} />
      </div>
      <div className="wrap int__grid">
        <div className="int__copy">
          <SectionHead id="int-title" title="Life interrupted. Your work remembered."
            lede="A message, a video, a friend at the door. You were halfway through a sentence. Pickup keeps your place in Chrome so the way back is one key, not five minutes of finding where you were." />
          <ol className="int__beats" role="list">
            <li className={phase === 'working' ? 'is-on' : ''}><span className="tnum">1</span>You're writing, with your research open.</li>
            <li className={phase === 'away' ? 'is-on' : ''}><span className="tnum">2</span>You leave for something else. Nothing is blocked.</li>
            <li className={phase === 'back' ? 'is-on' : ''}><span className="tnum">3</span>You come back and your place is waiting.</li>
          </ol>
        </div>

        <div className="int__demo">
          <p className="label int__sim">Simulation · not connected to your browser</p>
          <BrowserFrame tabs={tabs} active={active} groupName="Climate Essay" groupDim={phase === 'away'} reduced={reduced}
            label="Simulated browser window">
            <AnimatePresence mode="popLayout" initial={false}>
              {phase === 'away' ? (
                <motion.div key="vid" className="int__video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t}>
                  <Play size={34} aria-hidden="true" /><span>lo-fi beats to study to</span>
                </motion.div>
              ) : (
                <motion.div key="doc" className="int__doc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t}>
                  <p className="int__doc-h">The drought nobody planned for</p>
                  <p>Reservoirs that once refilled every spring now stay low into summer.</p>
                  <p><mark className="int__hl">Rainfall has been below average since 2023</mark>, and the gap matters most to farmers who</p>
                  <span className="int__caret" aria-hidden="true" />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {phase === 'back' && (
                <motion.div key="card" className="int__card-wrap" initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={t}>
                  <LiquidGlass variant="pearl" text radius={20} className="mini-card" role="status">
                    <p className="mini-card__title">Welcome back to <strong>Climate Essay</strong></p>
                    <p className="mini-card__meta tnum">Away 7 min · your next step</p>
                    <p className="mini-card__next">Find a source for the 2023 rainfall number</p>
                  </LiquidGlass>
                </motion.div>
              )}
            </AnimatePresence>
          </BrowserFrame>
          <div className="int__actions">
            {phase === 'working' && <GlassButton tone="blush" onClick={() => setPhase('away')} icon={<Play size={16} />}>Get distracted</GlassButton>}
            {phase === 'away' && <GlassButton tone="mint" onClick={() => setPhase('back')}>Come back</GlassButton>}
            {phase === 'back' && <GlassButton tone="quiet" onClick={() => setPhase('working')} icon={<RotateCcw size={16} />}>Start over</GlassButton>}
          </div>
        </div>
      </div>
    </section>
  );
}
