import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Coffee, RotateCcw, CornerDownLeft } from 'lucide-react';
import { Button, Keys, Mark, SectionHead } from '../components/ui';

type Phase = 'working' | 'parking' | 'away' | 'back' | 'resumed';

const ESSAY = [
  'Droughts in the region have grown longer over the past two decades, and towns that once refilled every spring now stay low into the summer.',
  "Rainfall has been below average since 2023, and the state's reservoirs were at about half of their usual level by the end of last summer.",
  'Some farmers have already switched to crops that need less water, such as sorghum instead of corn.',
];
const HIGHLIGHT = 1;

/** A labelled simulation of Pickup's loop on this page. It never touches the visitor's browser. */
export function TryIt({ reduced }: { reduced: boolean }) {
  const [phase, setPhase] = useState<Phase>('working');
  const [note, setNote] = useState('Find a source for the 2023 rainfall number');
  const [mins, setMins] = useState(0);
  const [tidied, setTidied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resumeBtn = useRef<HTMLButtonElement>(null);
  const live = useRef<HTMLParagraphElement>(null);

  // Simulated time: one real second is one minute away.
  useEffect(() => {
    if (phase !== 'away') return;
    const id = setInterval(() => setMins((m) => Math.min(m + 1, 99)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'parking') input.current?.focus();
    if (phase === 'back') resumeBtn.current?.focus();
  }, [phase]);

  const announce: Record<Phase, string> = {
    working: 'Working on the essay.',
    parking: 'Park prompt open. Type a next step, then press Enter.',
    away: 'Parked. You are away; time is running.',
    back: `Welcome back. Return card open: away ${mins} minutes. Press Enter to resume.`,
    resumed: 'Resumed: back at your spot with the highlighted sentence in view.',
  };

  const park = () => { setMins(0); setTidied(false); setPhase('away'); };
  const reset = () => { setPhase('working'); setMins(0); setTidied(false); };

  const cardKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setPhase('working'); }
    if (e.key.toLowerCase() === 't' && !tidied) { e.preventDefault(); setTidied(true); }
  };

  const ease = reduced ? { duration: 0 } : { type: 'spring' as const, bounce: 0.2, duration: 0.45 };

  return (
    <section className="try" id="try" aria-labelledby="try-title">
      <div className="wrap">
        <SectionHead
          id="try-title"
          title={<>You were in the middle of <Mark tone="pink">something.</Mark></>}
          lede="Take a break from this essay, come back, and see what Pickup hands you. It's a simulation on this page; it doesn't touch your browser."
        />

        <div className="try__layout">
          <div className={`browser browser--${phase}`}>
            <div className="browser__bar">
              <span className="browser__dots" aria-hidden="true"><i /><i /><i /></span>
              <ul className="browser__tabs" aria-label="Simulated tabs">
                <li className={`tab tab--group ${phase !== 'away' ? 'is-active' : ''}`}>Climate essay: draft</li>
                <li className="tab tab--group">Reservoir levels 2023</li>
                <AnimatePresence>
                  {phase === 'away' && (
                    <motion.li className="tab tab--break is-active" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={ease}>
                      Video: 10 hours of rain sounds
                    </motion.li>
                  )}
                </AnimatePresence>
                {tidied && phase !== 'away' && (
                  <motion.li className="tab tab--later" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={ease}>Later (1)</motion.li>
                )}
              </ul>
            </div>

            <div className="browser__page">
              <AnimatePresence mode="wait" initial={false}>
                {phase === 'away' ? (
                  <motion.div key="away" className="away" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }}>
                    <p className="away__label">Somewhere else</p>
                    <p className="away__time"><span className="tnum">{mins}</span> min away</p>
                    <p className="away__note">Pickup kept your place. No reminder unless you wrote a next step, and then only one.</p>
                  </motion.div>
                ) : (
                  <motion.article key="essay" className="essay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }}>
                    <p className="essay__meta">Draft for Ms. Rivera · 1,180 words</p>
                    {ESSAY.map((p, i) => (
                      <p key={i}>{i === HIGHLIGHT ? <span className={phase === 'resumed' ? 'essay__hl is-on' : 'essay__hl'}>{p}</span> : p}</p>
                    ))}
                  </motion.article>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {phase === 'parking' && (
                  <motion.form
                    key="park"
                    className="park"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={ease}
                    onSubmit={(e) => { e.preventDefault(); park(); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setPhase('working'); }}
                  >
                    <label className="park__label" htmlFor="park-note">Pickup · your next step <span>optional</span></label>
                    <input id="park-note" ref={input} className="park__input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
                    <div className="park__hint"><Keys keys={['Enter']} /> park it <Keys keys={['Esc']} /> cancel</div>
                  </motion.form>
                )}

                {phase === 'back' && (
                  <motion.div
                    key="card"
                    className="rcard"
                    role="dialog"
                    aria-labelledby="rcard-title"
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={ease}
                    onKeyDown={cardKeys}
                  >
                    <p className="rcard__kicker"><span className="rcard__dot" aria-hidden="true" />Welcome back</p>
                    <h3 id="rcard-title" className="rcard__title">Climate essay</h3>
                    <p className="rcard__meta">Away <span className="tnum">{mins}</span> min</p>
                    {note.trim() && (
                      <div className="rcard__next">
                        <p className="rcard__label">Your next step (you wrote this)</p>
                        <p>{note}</p>
                      </div>
                    )}
                    <p className="rcard__last"><span className="rcard__label">Last highlight</span> “{ESSAY[HIGHLIGHT].slice(0, 58)}…”</p>
                    <div className="rcard__actions">
                      <button ref={resumeBtn} type="button" className="rcard__resume" onClick={() => setPhase('resumed')}>
                        Resume <CornerDownLeft size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className="rcard__quiet" disabled={tidied} onClick={() => setTidied(true)}>{tidied ? 'Tidied into Later' : <>Tidy <kbd>T</kbd></>}</button>
                      <button type="button" className="rcard__quiet" onClick={() => setPhase('working')}>Not now <kbd>Esc</kbd></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="try__controls">
            <p className="sr-only" aria-live="polite" ref={live}>{announce[phase]}</p>
            <ol className="try__steps">
              <li className={phase === 'working' || phase === 'parking' ? 'is-now' : 'is-done'}>
                <span>Step away</span>
                <Button variant="secondary" icon={<Coffee size={16} aria-hidden="true" />} disabled={phase !== 'working'} onClick={() => setPhase('parking')}>
                  Take a break
                </Button>
              </li>
              <li className={phase === 'away' ? 'is-now' : phase === 'back' || phase === 'resumed' ? 'is-done' : ''}>
                <span>Come back after a while</span>
                <Button variant="secondary" disabled={phase !== 'away'} onClick={() => setPhase('back')}>Come back</Button>
              </li>
              <li className={phase === 'back' ? 'is-now' : phase === 'resumed' ? 'is-done' : ''}>
                <span>Pick up</span>
                <span className="try__hint">Press <Keys keys={['Enter']} /> on the card</span>
              </li>
            </ol>
            <AnimatePresence>
              {phase === 'resumed' && (
                <motion.div className="try__done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={ease}>
                  <p>Back at the sentence you highlighted, with your next step in front of you.</p>
                  <Button variant="ghost" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={reset}>Try again</Button>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="try__fine">Time runs fast here: one second is one minute.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
