import { useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Check, CornerDownLeft, Undo2 } from 'lucide-react';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import { GlassButton } from '../components/glass/GlassButton';
import { SectionHead, ShortcutHint } from '../components/ui';
import { SPRING_CARD, SPRING_PRESS } from '../styles/motion';

function ParkDemo({ reduced }: { reduced: boolean }) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const t = reduced ? { duration: 0 } : SPRING_CARD;
  return (
    <div className="fdemo fdemo--park">
      <AnimatePresence mode="popLayout" initial={false}>
        {saved === null ? (
          <motion.form key="f" className="park" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={t}
            onSubmit={(e) => { e.preventDefault(); setSaved(text.trim()); }}>
            <label htmlFor="park-in" className="park__label">Pickup · your next step <span>optional</span></label>
            <div className="park__row">
              <input id="park-in" ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="e.g. Outline paragraph 3" />
              <button type="submit" className="park__go" aria-label="Park it"><CornerDownLeft size={20} aria-hidden="true" /></button>
            </div>
            <p className="park__hint"><ShortcutHint keys={['Enter']} /> park it · <ShortcutHint keys={['Esc']} /> skip</p>
          </motion.form>
        ) : (
          <motion.div key="s" className="park-saved" role="status" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={reduced ? { duration: 0 } : SPRING_PRESS}>
            <svg className="park-saved__tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
            <span><strong>Parked.</strong> {saved ? <>Next: {saved}</> : 'No next step, just your place.'}</span>
            <button type="button" className="park-saved__again" onClick={() => { setSaved(null); setText(''); }}>Try again</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TABS = [
  { id: 'a', title: 'Climate essay: draft', kind: 'task' },
  { id: 'b', title: 'Lo-fi beats', kind: 'break' },
  { id: 'c', title: 'Reservoir levels 2023', kind: 'task' },
  { id: 'd', title: 'Group chat', kind: 'break' },
] as const;

function TidyDemo({ reduced }: { reduced: boolean }) {
  const [tidy, setTidy] = useState(false);
  const t = reduced ? { duration: 0 } : SPRING_PRESS;
  const task = TABS.filter((x) => x.kind === 'task');
  const breaks = TABS.filter((x) => x.kind === 'break');
  return (
    <div className="fdemo fdemo--tidy">
      <LayoutGroup>
        <ul className="tidy" aria-label="Example tabs">
          <motion.li layout transition={t} className="bf__group">Climate Essay</motion.li>
          {(tidy ? task : TABS).map((x) => (
            <motion.li layout key={x.id} transition={t} className={`bf__tab ${x.kind === 'task' ? 'is-group' : 'is-break'}`}>{x.title}</motion.li>
          ))}
          {tidy && (
            <motion.li layout key="later" transition={t} className="tidy__later" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}>
              Later ({breaks.length}) <span className="tidy__fold" aria-hidden="true">▸</span>
            </motion.li>
          )}
        </ul>
      </LayoutGroup>
      <div className="fdemo__actions">
        {!tidy ? <GlassButton tone="pearl" onClick={() => setTidy(true)}>Tidy <kbd className="keycap">T</kbd></GlassButton>
          : <GlassButton tone="quiet" onClick={() => setTidy(false)} icon={<Undo2 size={15} />}>Undo</GlassButton>}
        <p className="fdemo__fine" role="status">{tidy ? 'Two break tabs folded into a collapsed "Later" group. Nothing was closed.' : 'Two tabs here are from your break.'}</p>
      </div>
    </div>
  );
}

function JumpDemo({ reduced }: { reduced: boolean }) {
  const [back, setBack] = useState(false);
  const t = reduced ? { duration: 0 } : SPRING_PRESS;
  const tabs = ['Climate essay: draft', 'Group chat', 'Lo-fi beats'];
  return (
    <div className="fdemo">
      <LayoutGroup>
        <ul className="tidy" aria-label="Example tabs">
          {tabs.map((title, i) => {
            const on = back ? i === 0 : i === 1;
            return (
              <li key={title} className={`bf__tab jump__tab ${i === 0 ? 'is-group' : ''} ${on ? 'is-active' : ''}`} aria-current={on ? 'page' : undefined}>
                {on && <motion.span layoutId="jump-drop" className="jump__drop" transition={t} aria-hidden="true" />}
                <span>{title}</span>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
      <div className="fdemo__actions">
        <GlassButton tone="pearl" onClick={() => setBack((b) => !b)}>{back ? 'Reset' : <>Press <ShortcutHint keys={['Alt', 'R']} /></>}</GlassButton>
        <p className="fdemo__fine" role="status">{back ? 'Back on your task\'s tab, from anywhere in Chrome.' : 'You\'re in the group chat.'}</p>
      </div>
    </div>
  );
}

const SUPPORT = [
  { title: 'Task tab groups', body: 'Each task is a named Chrome tab group, so you can see which tabs belong to which job.' },
  { title: 'Drift nudge', body: 'One quiet notification per break, and only if you wrote a next step. It never blocks a site.' },
  { title: 'Your next step, three ways', body: 'Type it when you park, right-click a sentence and choose "Make this my next step", or, with voice turned on, say it in the panel.' },
  { title: 'Wrap up, then Start here', body: 'Save your place at night and get one "Start here" reminder with your next step the next morning.' },
  { title: 'Pickup panel', body: 'Ask "where was I?", set a break timer ("back in 10"), see your tasks and today\'s facts.', keys: ['Alt', 'V'] },
  { title: 'Lecture video', body: 'On resume, a video jumps back 10 seconds and waits, paused.' },
] as const;

export function Features({ reduced }: { reduced: boolean }) {
  return (
    <section className="section features" id="features" aria-labelledby="feat-title">
      <div className="atmo" aria-hidden="true">
        <span className="atmo__light atmo__light--mint" style={{ width: '46vw', height: '46vw', left: '-14vw', top: '12%' }} />
        <span className="atmo__light atmo__light--peach" style={{ width: '32vw', height: '32vw', right: '-8vw', top: '-4%' }} />
        <span className="atmo__light atmo__light--blush" style={{ width: '34vw', height: '34vw', right: '6vw', bottom: '-6%' }} />
      </div>
      <div className="wrap">
        <SectionHead id="feat-title" title="Everything in v1.0, doing one job well."
          lede="What Pickup does today. Each demo below runs on this page only." />

        <div className="fgal">
          <LiquidGlass as="article" variant="gel" tint="lilac" radius="40px 40px 40px 24px" text className="fpanel fpanel--park">
            <div className="fpanel__copy">
              <h3 className="h3">Park before you go <ShortcutHint keys={['Alt', 'P']} /></h3>
              <p>Leave yourself one line. Or don't: Pickup saves your place either way, and Esc skips the prompt.</p>
            </div>
            <ParkDemo reduced={reduced} />
          </LiquidGlass>

          <LiquidGlass as="article" variant="pearl" radius={30} text className="fpanel fpanel--jump">
            <div className="fpanel__copy">
              <h3 className="h3">Back to the task</h3>
              <p>From any tab in Chrome. On the return card, Enter does the same and restores your scroll.</p>
            </div>
            <JumpDemo reduced={reduced} />
          </LiquidGlass>

          <LiquidGlass as="article" variant="gel" tint="mint" radius={36} text className="fpanel fpanel--tidy">
            <div className="fpanel__copy">
              <h2 className="h2 fpanel__big">Tidy, never delete.</h2>
              <p>Tabs you opened on a break fold into a collapsed "Later" group. You decide what to close.</p>
            </div>
            <TidyDemo reduced={reduced} />
          </LiquidGlass>

          <div className="fsupport">
            <figure className="fsupport__shot">
              <img src="assets/shot-panel.jpg" width={720} height={1600} loading="lazy" decoding="async"
                alt="The Pickup side panel: an Ask box with suggestions like Where was I?, a break timer, and the task list with Resume." />
              <figcaption>The Pickup panel. Real screenshot, Chrome for Testing.</figcaption>
            </figure>
            <ul className="flist" role="list">
              {SUPPORT.map((f) => (
                <li key={f.title} className="flist__row">
                  <h3 className="flist__title"><Check size={16} aria-hidden="true" className="flist__check" />{f.title} {'keys' in f && <ShortcutHint keys={f.keys} />}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
