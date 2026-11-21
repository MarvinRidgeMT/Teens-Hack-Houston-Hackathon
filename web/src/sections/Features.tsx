import { useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Button, Keys, Mark, SectionHead } from '../components/ui';

const spring = { type: 'spring' as const, bounce: 0.18, duration: 0.5 };

function ParkDemo({ reduced }: { reduced: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const t = reduced ? { duration: 0 } : spring;

  const start = () => { setSaved(null); setOpen(true); };

  return (
    <div
      className="demo demo--park"
      onKeyDown={(e) => { if (e.altKey && e.code === 'KeyP') { e.preventDefault(); start(); } }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {open ? (
          <motion.form key="form" className="mini-park" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={t}
            onSubmit={(e) => { e.preventDefault(); setSaved(note.trim() || 'No next step, just your place'); setOpen(false); setNote(''); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
            <label htmlFor="mini-park-input" className="mini-park__label">Your next step <span>optional</span></label>
            <input id="mini-park-input" ref={input} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Outline paragraph 3" maxLength={120} />
            <p className="mini-park__hint"><Keys keys={['Enter']} /> park it</p>
          </motion.form>
        ) : saved ? (
          <motion.p key="saved" className="saved-chip" role="status" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={t}>
            <Check size={16} aria-hidden="true" /> Parked: {saved}
          </motion.p>
        ) : (
          <motion.div key="idle" className="demo__idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button variant="secondary" onClick={start}>Open the park prompt</Button>
            <p className="demo__fine">It asks once and gets out of the way: Enter parks it, Esc skips it, and either way your place is saved.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type T = { id: string; title: string; kind: 'task' | 'break' };
const START: T[] = [
  { id: 'a', title: 'Climate essay: draft', kind: 'task' },
  { id: 'b', title: 'Lo-fi beats', kind: 'break' },
  { id: 'c', title: 'Reservoir levels 2023', kind: 'task' },
  { id: 'd', title: 'Group chat', kind: 'break' },
];

function TabsDemo({ reduced }: { reduced: boolean }) {
  const [grouped, setGrouped] = useState(false);
  const [tidied, setTidied] = useState(false);
  const t = reduced ? { duration: 0 } : spring;
  const task = START.filter((x) => x.kind === 'task');
  const breaks = START.filter((x) => x.kind === 'break');
  const order = grouped ? [...task, ...breaks] : START;

  return (
    <div className="demo demo--tabs">
      <LayoutGroup>
        <ul className="tabstrip" aria-label="Example tabs">
          {grouped && (
            <motion.li layout key="g" className="tabstrip__group" transition={t}>Climate essay</motion.li>
          )}
          {order.map((x) => {
            const hidden = tidied && x.kind === 'break';
            if (hidden) return null;
            return (
              <motion.li layout key={x.id} transition={t} className={`tabstrip__tab ${grouped && x.kind === 'task' ? 'in-group' : ''} ${x.kind === 'break' ? 'is-break' : ''}`}>
                {x.title}
              </motion.li>
            );
          })}
          {tidied && (
            <motion.li layout key="later" className="tabstrip__later" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={t}>
              Later ({breaks.length})
            </motion.li>
          )}
        </ul>
      </LayoutGroup>
      <div className="demo__actions">
        <Button variant="secondary" disabled={grouped} onClick={() => setGrouped(true)}>Group the task</Button>
        <Button variant="secondary" disabled={!grouped || tidied} onClick={() => setTidied(true)}>Tidy <kbd>T</kbd></Button>
        {(grouped || tidied) && <Button variant="ghost" onClick={() => { setGrouped(false); setTidied(false); }}>Reset</Button>}
      </div>
      <p className="demo__fine" role="status">{tidied ? 'Break tabs are in a collapsed "Later" group. Nothing was closed.' : grouped ? "The task's tabs share one named group." : ''}</p>
    </div>
  );
}

function DriftDemo({ reduced }: { reduced: boolean }) {
  const [shown, setShown] = useState(false);
  const t = reduced ? { duration: 0 } : spring;
  return (
    <div className="demo demo--drift">
      <p className="demo__fine">You wrote a next step and left for a video. Five minutes later:</p>
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div key="n" className="notif" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={t}>
            <span className="pk-mark" style={{ width: 28, height: 28 }} aria-hidden="true" />
            <div>
              <p className="notif__title">Your next step for Climate essay</p>
              <p className="notif__body">Next: Find a source for the 2023 rainfall number · Alt+R takes you back</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="demo__actions">
        <Button variant="secondary" onClick={() => setShown((v) => !v)}>{shown ? 'Dismiss' : 'Skip ahead 5 minutes'}</Button>
      </div>
      <p className="demo__fine">That's the only one for this break. No next step written, no reminder.</p>
    </div>
  );
}

function AltRDemo({ reduced }: { reduced: boolean }) {
  const [back, setBack] = useState(false);
  const t = reduced ? { duration: 0 } : spring;
  return (
    <div className="demo demo--altr" onKeyDown={(e) => { if (e.altKey && e.code === 'KeyR') { e.preventDefault(); setBack(true); } }}>
      <LayoutGroup>
        <ul className="tabstrip" aria-label="Example tabs">
          {['Climate essay: draft', 'Group chat', 'Lo-fi beats'].map((title, i) => {
            const active = back ? i === 0 : i === 1;
            return (
              <motion.li layout key={title} transition={t} className={`tabstrip__tab ${active ? 'is-active' : ''} ${i === 0 ? 'in-group' : ''}`} aria-current={active ? 'page' : undefined}>
                {title}
              </motion.li>
            );
          })}
        </ul>
      </LayoutGroup>
      <div className="demo__actions">
        <Button variant="secondary" disabled={back} onClick={() => setBack(true)}>Jump back</Button>
        {back && <Button variant="ghost" onClick={() => setBack(false)}>Reset</Button>}
      </div>
      <p className="demo__fine" role="status">{back ? "You're on your task's tab again, from anywhere in Chrome." : 'You are in the group chat tab.'}</p>
    </div>
  );
}

const MORE = [
  { title: 'Make this my next step', body: 'Right-click a sentence on a work page to save it as your next step.' },
  { title: 'Wrap up, then Start here', body: 'Save your place at night; get one "Start here" reminder the next morning.' },
  { title: 'Pickup panel', body: 'Ask "where was I?", set a break timer ("back in 10"), see your tasks.', keys: ['Alt', 'V'] },
  { title: 'Lecture video', body: 'On resume, a video goes back 10 seconds and waits, paused.' },
  { title: 'Comeback receipt', body: "Save a picture of this week's comebacks from the dashboard: how many, and your longest break. No streaks." },
  { title: '"Hey Pickup" voice', body: 'Optional and off by default. Recognised on your device; no audio is kept.' },
] as const;

export function Features({ reduced }: { reduced: boolean }) {
  return (
    <section className="features" id="features" aria-labelledby="features-title">
      <div className="wrap">
        <SectionHead id="features-title" title={<>Everything in v1.0, <Mark>doing its job.</Mark></>} lede="What Pickup does today. No roadmap items on this page." />

        <article className="feat-hero">
          <div className="feat-hero__copy">
            <h3 className="h3">The return card</h3>
            <p>The one screen Pickup is built around. It opens when you come back to a work page, and every line on it is something you did or wrote.</p>
            <dl className="callouts">
              <div><dt>Task</dt><dd>The tab group's name, so you know which job this is.</dd></div>
              <div><dt>Time away</dt><dd>A fact, never a warning.</dd></div>
              <div><dt>Your next step</dt><dd>In your words, labelled "you wrote this".</dd></div>
              <div><dt>Last highlight</dt><dd>The sentence you were on.</dd></div>
              <div><dt>Keys</dt><dd><Keys keys={['Enter']} /> resume · <Keys keys={['T']} /> tidy · <Keys keys={['Esc']} /> not now</dd></div>
            </dl>
          </div>
          <figure className="feat-hero__shot">
            <img src="assets/shot-card.jpg" width={1600} height={1000} loading="lazy" alt="Pickup's return card over a student's essay draft: welcome back to Climate Essay, the next step the student wrote, the sentence they last highlighted, and Resume, Tidy and Not now." />
            <figcaption>Real screenshot, Chrome for Testing.</figcaption>
          </figure>
        </article>

        {/* An editorial gallery: unequal spans, and each piece built its own way. */}
        <div className="gallery">
          <article className="feat-tile feat-tile--yellow g-park">
            <h3 className="h3">Park before you go <Keys keys={['Alt', 'P']} /></h3>
            <p>Leave yourself one line. Or don't: Pickup saves your place either way.</p>
            <ParkDemo reduced={reduced} />
          </article>
          <article className="feat-tile feat-tile--cyan g-tabs">
            <h3 className="h3">Tab groups and Tidy</h3>
            <p>Each task is a named Chrome tab group. Tabs you opened on a break go into a collapsed "Later" group, and nothing is closed.</p>
            <TabsDemo reduced={reduced} />
          </article>
          <article className="feat-tile feat-tile--pink feat-band g-drift">
            <div className="feat-band__copy">
              <h3 className="h2 feat-band__title">Drift nudge</h3>
              <p>One quiet reminder per break, and only if you left yourself a next step. It never blocks a site.</p>
            </div>
            <DriftDemo reduced={reduced} />
          </article>
          <article className="feat-tile feat-tile--lime g-altr">
            <h3 className="h3">Back to the task <Keys keys={['Alt', 'R']} /></h3>
            <p>From any tab in Chrome.</p>
            <AltRDemo reduced={reduced} />
          </article>
          <ul className="feat-list g-list">
            {MORE.map((f) => (
              <li key={f.title} className="feat-row">
                <h3 className="feat-row__title">{f.title} {'keys' in f && <Keys keys={f.keys} />}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
