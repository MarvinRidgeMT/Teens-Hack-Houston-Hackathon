import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDownToLine, Play } from 'lucide-react';
import { ButtonLink, Keys, Mark } from '../components/ui';
import { WALKTHROUGH } from '../content/site';
import { story, screenForStep, type Screen } from '../three/story';
import { SCREEN_ALT } from '../three/screens';
import { useCan3D } from '../hooks/motion';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const LaptopScene = lazy(() => import('../three/LaptopScene'));

const SHOT: Record<Screen, string> = {
  card: 'assets/shot-card.jpg',
  leave: 'assets/shot-leave.jpg',
  drift: 'assets/shot-panel.jpg',
  resume: 'assets/shot-resume.jpg',
};

/** The CSS laptop: first paint, the no-WebGL fallback, and the mobile rendition. */
function FlatLaptop({ screen }: { screen: Screen }) {
  const portrait = screen === 'drift';
  return (
    <figure className="flat-laptop">
      <div className="flat-laptop__lid">
        <div className="flat-laptop__screen">
          <img
            key={screen}
            src={portrait ? SHOT.resume : SHOT[screen]}
            alt={SCREEN_ALT[screen]}
            width={1600}
            height={1000}
            className="flat-laptop__img"
          />
          {portrait && <img src={SHOT.drift} alt="" className="flat-laptop__panel" width={720} height={1600} />}
        </div>
      </div>
      <div className="flat-laptop__base" aria-hidden="true" />
    </figure>
  );
}

function Stage({ reduced }: { reduced: boolean }) {
  const can3D = useCan3D();
  const [failed, setFailed] = useState(false);
  const [screen, setScreen] = useState<Screen>(screenForStep(story.step));

  useEffect(() => story.subscribe((s) => setScreen(screenForStep(s))), []);

  // Gentle pointer response, fine pointers only.
  useEffect(() => {
    if (reduced || !matchMedia('(pointer: fine)').matches) return;
    const on = (e: PointerEvent) => {
      story.pointerX = (e.clientX / innerWidth) * 2 - 1;
      story.pointerY = (e.clientY / innerHeight) * 2 - 1;
    };
    addEventListener('pointermove', on, { passive: true });
    return () => removeEventListener('pointermove', on);
  }, [reduced]);

  const use3D = can3D && !failed;
  return (
    <div className="stage">
      {use3D ? (
        <>
          {/* Screen readers get the same picture the canvas shows. */}
          <p className="sr-only" aria-live="polite">{SCREEN_ALT[screen]}</p>
          <Suspense fallback={<FlatLaptop screen={screen} />}>
            <LaptopScene reduced={reduced} onFail={() => setFailed(true)} />
          </Suspense>
        </>
      ) : (
        <FlatLaptop screen={screen} />
      )}
    </div>
  );
}

export function Story({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => story.subscribe(setActive), []);

  useGSAP(() => {
    const q = gsap.utils.selector(root);
    if (reduced) {
      story.intro = 1;
    } else {
      // Opening: the headline lines rise, the lime stroke draws, then the rest settles.
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from(q('.hero__line'), { yPercent: 110, duration: 1.1, stagger: 0.09 }, 0.15)
        .fromTo(q('.hero h1 .hl'), { '--stroke': 0 }, { '--stroke': 1, duration: 0.9, ease: 'power3.inOut' }, 0.75)
        .from(q('.hero__lede, .hero__ctas, .hero__facts'), { autoAlpha: 0, y: 16, duration: 0.8, stagger: 0.08 }, 0.6);
    }

    // The scene shifts from violet (the noisy outside) to midnight (calm) as the walkthrough starts.
    gsap.fromTo(root.current, { '--story-bg': '#6038ff' }, {
      '--story-bg': '#121126',
      ease: 'none',
      scrollTrigger: { trigger: q('.walk')[0], start: 'top 85%', end: 'top 25%', scrub: true },
    });

    // Each step drives the laptop's screen and camera.
    q('.walk__step').forEach((el, i) => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 62%',
        end: 'bottom 62%',
        onToggle: (self) => { if (self.isActive) story.setStep(i); },
        onLeaveBack: () => { if (i === 0) story.setStep(-1); },
      });
    });
  }, { scope: root, dependencies: [reduced] });

  const goTo = (i: number) => {
    const el = document.getElementById(`step-${WALKTHROUGH[i].id}`);
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    story.setStep(i);
  };

  return (
    <div className="story" ref={root}>
      <div className="story__grid">
        <div className="story__copy">
          <section className="hero" id="top" aria-labelledby="hero-title">
            <h1 id="hero-title" className="hero__title">
              <span className="hero__mask"><span className="hero__line">Undo <Mark>the interruption,</Mark></span></span>
              <span className="hero__mask"><span className="hero__line">not the mistake.</span></span>
            </h1>
            <p className="hero__lede">
              A Chrome extension that remembers where you left off: the tab, the spot on the page, the next step you wrote. Come back, press <kbd className="keycap keycap--inline">Enter</kbd>, keep going.
            </p>
            <div className="hero__ctas">
              <ButtonLink href="#install" variant="primary" icon={<ArrowDownToLine size={18} aria-hidden="true" />}>Download for Chrome</ButtonLink>
              <ButtonLink href="#demo" variant="on-violet" icon={<Play size={16} aria-hidden="true" />}>Watch the demo</ButtonLink>
            </div>
            <ul className="hero__facts" aria-label="At a glance">
              <li>Free</li>
              <li>No account</li>
              <li>Nothing leaves your computer</li>
            </ul>
            <div className="hero__mobile-stage"><FlatLaptop screen="card" /></div>
          </section>

          <section className="walk" id="how" aria-labelledby="how-title">
            <h2 id="how-title" className="h2 walk__title">Leave. Return. Pick up exactly where you left off.</h2>
            <div className="walk__dots" role="group" aria-label="Walkthrough steps">
              {WALKTHROUGH.map((s, i) => (
                <button key={s.id} type="button" className={`walk__dot ${active === i ? 'is-active' : ''}`} aria-current={active === i ? 'step' : undefined} onClick={() => goTo(i)}>
                  <span className="walk__dot-num">{i + 1}</span>
                  <span className="walk__dot-label">{s.title}</span>
                </button>
              ))}
            </div>
            <ol className="walk__steps">
              {WALKTHROUGH.map((s, i) => (
                <li key={s.id} id={`step-${s.id}`} className={`walk__step ${active === i ? 'is-active' : ''}`}>
                  <h3 className="walk__step-title">
                    <span className="walk__stroke">{s.title}</span>
                    <Keys keys={s.keys} />
                  </h3>
                  <p className="walk__body">{s.body}</p>
                  <div className="walk__mobile-shot"><FlatLaptop screen={screenForStep(i)} /></div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="story__stage">
          <Stage reduced={reduced} />
        </div>
      </div>
    </div>
  );
}
