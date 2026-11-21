import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ArrowDownToLine, ArrowDown, Layers, PauseCircle } from 'lucide-react';
import { GlassButton } from '../components/glass/GlassButton';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import { LaptopStage, DeviceFrame } from '../components/Stage';
import { HERO, LINKS } from '../content/site';
import { SCREEN_ALT } from '../three/screens';
import { story } from '../three/story';
import { EASE } from '../styles/motion';

gsap.registerPlugin(useGSAP);

const HERO_MARGIN = { left: 24, right: 24, top: 110, bottom: 40 };

export function Hero({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLElement>(null);

  // Pointer: the laptop eases a few degrees, the glass objects parallax ≤ 12px. Fine pointers only.
  useEffect(() => {
    if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const el = root.current;
    if (!el) return;
    const xs = gsap.utils.toArray<HTMLElement>('[data-depth]', el).map((n) => ({
      n, d: Number(n.dataset.depth), x: gsap.quickTo(n, 'x', { duration: 0.6, ease: EASE.enter }), y: gsap.quickTo(n, 'y', { duration: 0.6, ease: EASE.enter }),
    }));
    const on = (e: PointerEvent) => {
      const px = (e.clientX / innerWidth) * 2 - 1;
      const py = (e.clientY / innerHeight) * 2 - 1;
      story.pointerX = px;
      story.pointerY = py;
      xs.forEach(({ d, x, y }) => { x(px * 12 * d); y(py * 8 * d); });
    };
    addEventListener('pointermove', on, { passive: true });
    return () => { removeEventListener('pointermove', on); story.pointerX = 0; story.pointerY = 0; };
  }, [reduced]);

  // Opening: the headline, lede and buttons are in the prerendered HTML and never hidden (they are the
  // first paint). Only decoration plays in: the light volumes settle, then the context objects.
  // index.html adds .js-intro before first paint (motion allowed), which starts those at opacity 0.
  useGSAP(() => {
    const q = gsap.utils.selector(root);
    if (reduced) { document.documentElement.classList.remove('js-intro'); return; }
    const tl = gsap.timeline({ defaults: { ease: EASE.hero }, onComplete: () => document.documentElement.classList.remove('js-intro') });
    tl.fromTo(q('.atmo__light'), { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 1.4, stagger: 0.12 }, 0)
      .fromTo(q('.hero-obj'), { autoAlpha: 0, y: 18, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, stagger: 0.09, ease: EASE.enter }, 0.5);
  }, { scope: root, dependencies: [reduced] });

  return (
    <section ref={root} className="hero" id="top" aria-labelledby="hero-title">
      <div className="atmo" aria-hidden="true">
        <span className="atmo__light atmo__light--lilac" style={{ width: '58vw', height: '58vw', left: '-14vw', top: '-22vw' }} />
        <span className="atmo__light atmo__light--mint" style={{ width: '40vw', height: '40vw', left: '8vw', bottom: '-18vw' }} />
        <span className="atmo__light atmo__light--blush" style={{ width: '34vw', height: '34vw', right: '-10vw', top: '18%' }} />
      </div>
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <h1 id="hero-title" className="display hero__title">
            <span className="hero__mask"><span className="hero__line">Undo the interruption,</span></span>
            <span className="hero__mask"><span className="hero__line hero__line--soft">not the mistake.</span></span>
          </h1>
          <p className="lede hero__lede">{HERO.lede}</p>
          <div className="hero__ctas">
            <GlassButton href={LINKS.download} tone="mint" size="lg" magnetic icon={<ArrowDownToLine size={19} />}>Download Pickup</GlassButton>
            <GlassButton href="#story" tone="pearl" size="lg" icon={<ArrowDown size={18} />}>See how it works</GlassButton>
          </div>
          <ul className="hero__facts" role="list" aria-label="At a glance">
            {HERO.facts.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>

        <div className="hero__stage">
          <div className="hero__canvas">
            <LaptopStage mode="hero" reduced={reduced} margin={HERO_MARGIN}
              fallback={<DeviceFrame poster src="assets/shot-card.jpg" alt={SCREEN_ALT.return} />} />
          </div>
          <p className="sr-only">{SCREEN_ALT.return}</p>
          {/* Context objects: each is a real thing Pickup keeps. Same light as the scene: rim top-left, shadow below. */}
          <div className="hero-obj hero-obj--task" data-depth="1" aria-hidden="true">
            <LiquidGlass variant="gel" tint="lilac" radius={22} text className="ctx ctx--task">
              <span className="ctx__icon"><Layers size={18} /></span>
              <span><strong>{HERO.task.name}</strong><small>{HERO.task.meta} · tab group</small></span>
            </LiquidGlass>
            <span className="lg-contact" />
          </div>
          <div className="hero-obj hero-obj--next" data-depth="1.6" aria-hidden="true">
            <LiquidGlass variant="crystal" radius={999} text className="ctx ctx--next">
              <span className="ctx__tag">Next</span><span>{HERO.next}</span>
            </LiquidGlass>
            <span className="lg-contact" />
          </div>
          <div className="hero-obj hero-obj--away" data-depth="0.7" aria-hidden="true">
            <LiquidGlass variant="gel" tint="blush" radius={999} text className="ctx ctx--away">
              <PauseCircle size={16} /><span className="tnum">{HERO.away}</span>
            </LiquidGlass>
          </div>
        </div>
      </div>
    </section>
  );
}
