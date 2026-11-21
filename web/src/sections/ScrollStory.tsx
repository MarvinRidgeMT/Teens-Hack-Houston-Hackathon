import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Layers, PlayCircle, Bell, FolderClosed } from 'lucide-react';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import { LaptopStage, DeviceFrame } from '../components/Stage';
import { ShortcutHint } from '../components/ui';
import { STORY } from '../content/site';
import { story } from '../three/story';
import { SCREEN_ALT } from '../three/screens';
import { useCan3D } from '../hooks/motion';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STORY_MARGIN = { left: 24, right: 32, top: 120, bottom: 48 };
const SHOT: Record<string, string> = {
  working: 'assets/shot-resume.jpg', interrupted: 'assets/shot-resume.jpg', park: 'assets/shot-leave.jpg',
  return: 'assets/shot-card.jpg', resume: 'assets/shot-resume.jpg',
};

/** The pinned story (desktop with motion). One ScrollTrigger timeline with a label per scene. */
function Pinned({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [scene, setScene] = useState(0);
  useEffect(() => story.subscribe(setScene), []);

  useGSAP(() => {
    const q = gsap.utils.selector(root);
    const n = STORY.length;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut', duration: 1 },
      scrollTrigger: {
        trigger: root.current, start: 'top top', end: `+=${(n - 1) * 95}%`, pin: q('.story__pin')[0], scrub: 0.7,
        onUpdate: (self) => {
          story.progress = self.progress;
          story.setScene(Math.min(n - 1, Math.round(self.progress * (n - 1))));
        },
      },
    });
    // captions: one at a time, each rising into place
    q('.story__cap').forEach((cap, i) => {
      if (i > 0) tl.fromTo(cap, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.5 }, i - 0.5);
      if (i < n - 1) tl.to(cap, { autoAlpha: 0, y: -24, duration: 0.5 }, i + 0.1);
    });
    tl.addLabel('working', 0).addLabel('interrupted', 1).addLabel('park', 2).addLabel('return', 3).addLabel('resume', 4);
    // context bubbles reposition with the story (never random bouncing)
    tl.to(q('.sb--task'), { x: -40, y: -24, opacity: 0.55, scale: 0.94 }, 0.3)      // interrupted: task drifts back, dimmed
      .fromTo(q('.sb--away'), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.5 }, 0.5)
      .to(q('.sb--away'), { autoAlpha: 0, x: 30, duration: 0.4 }, 1.6)
      .fromTo(q('.sb--next'), { autoAlpha: 0, y: 30, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6 }, 1.4) // park: next step typed
      .to(q('.sb--task'), { x: 120, y: 150, opacity: 0, scale: 0.7, duration: 0.6 }, 1.7)                                 // gathers into the capsule
      .fromTo(q('.sb--saved'), { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.4 }, 2.05)
      .to(q('.sb--next, .sb--saved'), { y: -40, autoAlpha: 0, duration: 0.5 }, 2.6)                                      // return: the card takes focus
      .fromTo(q('.sb--timer'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 2.8)
      .to(q('.sb--timer'), { autoAlpha: 0, duration: 0.4 }, 3.55)
      .fromTo(q('.sb--back, .sb--later'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.12 }, 3.6) // resume
      .to(q('.story__light--blush'), { opacity: 1, duration: 1 }, 0.4)
      .to(q('.story__light--blush'), { opacity: 0.2, duration: 1 }, 2.2)
      .to(q('.story__light--mint'), { opacity: 1, duration: 1 }, 3.2);
    q('.story__tick').forEach((tick, i) => {
      tl.to(tick, { '--on': 1, duration: 0.3 }, Math.max(0, i - 0.3));
    });
  }, { scope: root });

  const jump = (i: number) => {
    const st = ScrollTrigger.getAll().find((s) => s.trigger === root.current);
    if (!st) return;
    const y = st.start + (st.end - st.start) * (i / (STORY.length - 1));
    window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <section ref={root} className="story" id="story" aria-labelledby="story-title">
      <div className="story__pin">
        <div className="atmo" aria-hidden="true">
          <span className="atmo__light atmo__light--lilac" style={{ width: '50vw', height: '50vw', left: '-14vw', top: '-10vw' }} />
          <span className="atmo__light atmo__light--blush story__light--blush" style={{ width: '38vw', height: '38vw', right: '-6vw', top: '6vw', opacity: 0.2 }} />
          <span className="atmo__light atmo__light--mint story__light--mint" style={{ width: '44vw', height: '44vw', right: '8vw', bottom: '-18vw', opacity: 0.35 }} />
        </div>
        <div className="wrap story__grid">
          <div className="story__copy">
            <h2 id="story-title" className="label story__kicker">How it works</h2>
            <div className="story__caps">
              {STORY.map((s, i) => (
                <div key={s.id} className="story__cap" aria-hidden={scene !== i}>
                  <p className="h2 story__cap-title">{s.title} {s.keys.length > 0 && <ShortcutHint keys={s.keys} />}</p>
                  <p className="lede story__cap-body">{s.body}</p>
                </div>
              ))}
            </div>
            <nav className="story__ticks" aria-label="Story steps">
              {STORY.map((s, i) => (
                <button key={s.id} type="button" className={`story__tick ${scene === i ? 'is-on' : ''}`} aria-current={scene === i ? 'step' : undefined} onClick={() => jump(i)}>
                  <span className="tnum">{i + 1}</span> {s.title}
                </button>
              ))}
            </nav>
            <p className="sr-only" aria-live="polite">{STORY[scene].title}: {SCREEN_ALT[STORY[scene].id]}</p>
          </div>
          <div className="story__stage">
            <div className="story__canvas">
              <LaptopStage mode="story" reduced={reduced} margin={STORY_MARGIN}
                fallback={<DeviceFrame src={SHOT[STORY[scene].id]} alt={SCREEN_ALT[STORY[scene].id]} />} />
            </div>
            <div className="sb sb--task" aria-hidden="true"><LiquidGlass variant="gel" tint="lilac" radius={20} text className="ctx ctx--task"><span className="ctx__icon"><Layers size={18} /></span><span><strong>Climate Essay</strong><small>3 research tabs · tab group</small></span></LiquidGlass></div>
            <div className="sb sb--away" aria-hidden="true"><LiquidGlass variant="gel" tint="blush" radius={999} text className="ctx ctx--away"><PlayCircle size={16} /> Video: lo-fi beats</LiquidGlass></div>
            <div className="sb sb--next" aria-hidden="true"><LiquidGlass variant="crystal" radius={999} text className="ctx ctx--next"><span className="ctx__tag">Next</span>Find a source for the drought statistic</LiquidGlass></div>
            <div className="sb sb--saved" aria-hidden="true"><LiquidGlass variant="gel" tint="mint" radius={999} text className="ctx ctx--away"><Check size={16} /> Saved: place, tabs, next step</LiquidGlass></div>
            <div className="sb sb--timer" aria-hidden="true"><LiquidGlass variant="gel" tint="blush" radius={999} text className="ctx ctx--away"><Bell size={15} /> <span className="tnum">Away 12 min</span></LiquidGlass></div>
            <div className="sb sb--back" aria-hidden="true"><LiquidGlass variant="gel" tint="mint" radius={999} text className="ctx ctx--away"><Check size={16} /> Back at your spot</LiquidGlass></div>
            <div className="sb sb--later" aria-hidden="true"><LiquidGlass variant="gel" tint="lilac" radius={999} text className="ctx ctx--away"><FolderClosed size={15} /> Later (1) · nothing closed</LiquidGlass></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Reduced motion, small screens and no-WebGL: five calm panels, real screenshots, no pin. */
function Stacked() {
  return (
    <section className="section story-stack" id="story" aria-labelledby="story-title">
      <div className="wrap">
        <h2 id="story-title" className="h2 story-stack__title">How it works</h2>
        <ol className="story-stack__list" role="list">
          {STORY.map((s, i) => (
            <li key={s.id} className="story-stack__item">
              <div className="story-stack__copy">
                <p className="label tnum">Step {i + 1}</p>
                <h3 className="h3">{s.title} {s.keys.length > 0 && <ShortcutHint keys={s.keys} />}</h3>
                <p>{s.body}</p>
              </div>
              {s.id === 'interrupted' ? (
                <LiquidGlass variant="pearl" text radius={22} className="story-stack__nudge" role="img" aria-label="Pickup's one nudge per break, shown only if you wrote a next step">
                  <span className="label">Pickup · one nudge per break</span>
                  <strong>Your next step for Climate Essay</strong>
                  <span>Next: Find a source for the drought statistic · Alt+R takes you back</span>
                </LiquidGlass>
              ) : (
                <DeviceFrame src={SHOT[s.id]} alt={SCREEN_ALT[s.id]} />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ScrollStory({ reduced }: { reduced: boolean }) {
  const can3D = useCan3D();
  return !reduced && can3D ? <Pinned reduced={reduced} /> : <Stacked />;
}
