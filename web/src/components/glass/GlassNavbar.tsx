import { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { ArrowDownToLine, Menu, X } from 'lucide-react';
import { LiquidGlass } from './LiquidGlass';
import { GlassButton } from './GlassButton';
import { BrandMark } from '../ui';
import { LINKS, NAV_ITEMS } from '../../content/site';
import { SPRING_DROPLET } from '../../styles/motion';

/** Which section is on screen: the droplet follows it (and the pointer, on hover). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const seen = new Map<string, number>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      let best: string | null = null;
      let ratio = 0;
      seen.forEach((r, id) => { if (r > ratio) { ratio = r; best = id; } });
      setActive(best);
    }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.01, 0.5, 1] });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ids]);
  return active;
}

const IDS = NAV_ITEMS.map((i) => i.href.slice(1));

export function GlassNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const active = useActiveSection(IDS);
  const sheet = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const lit = hover ?? (active ? `#${active}` : null);

  useEffect(() => {
    const on = () => setScrolled(scrollY > 24);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);

  const open = () => { sheet.current?.showModal(); document.documentElement.classList.add('is-locked'); };
  const close = () => { sheet.current?.close(); };
  const onClosed = () => { document.documentElement.classList.remove('is-locked'); opener.current?.focus(); };

  return (
    <header className={`gnav ${scrolled ? 'gnav--scrolled' : ''}`}>
      <LiquidGlass as="nav" variant="pearl" className="gnav__bar" aria-label="Main" rest={[18, 0]}>
        <a className="gnav__brand" href="#top"><BrandMark size={28} /> Pickup</a>
        <LayoutGroup id="nav">
          <ul className="gnav__links" onPointerLeave={() => setHover(null)}>
            {NAV_ITEMS.map((i) => (
              <li key={i.href}>
                <a className="gnav__link" href={i.href} aria-current={active === i.href.slice(1) ? 'location' : undefined}
                  onPointerEnter={() => setHover(i.href)} onFocus={() => setHover(i.href)} onBlur={() => setHover(null)}>
                  {lit === i.href && (
                    <motion.span layoutId="droplet" className="gnav__drop" aria-hidden="true" transition={SPRING_DROPLET}
                      initial={false} animate={{ scaleX: 1 }} />
                  )}
                  <span>{i.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </LayoutGroup>
        <GlassButton href={LINKS.download} tone="mint" className="gnav__cta" icon={<ArrowDownToLine size={17} />}>Download</GlassButton>
        <button ref={opener} className="gnav__menu" type="button" aria-label="Open menu" aria-haspopup="dialog" onClick={open}>
          <Menu size={22} aria-hidden="true" />
        </button>
      </LiquidGlass>

      <dialog ref={sheet} className="gsheet" aria-label="Menu" onClose={onClosed}
        onClick={(e) => { if (e.target === sheet.current) close(); }}>
        <LiquidGlass variant="pearl" text className="gsheet__panel">
          <div className="gsheet__top">
            <span className="gnav__brand"><BrandMark size={28} /> Pickup</span>
            <button className="gnav__menu" style={{ display: 'inline-grid' }} type="button" aria-label="Close menu" onClick={close} autoFocus>
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <ul className="gsheet__links">
            {NAV_ITEMS.map((i) => <li key={i.href}><a href={i.href} onClick={close}>{i.label}</a></li>)}
          </ul>
          <div className="gsheet__cta">
            <GlassButton href={LINKS.download} tone="mint" size="lg" onClick={close} icon={<ArrowDownToLine size={18} />}>Download Pickup</GlassButton>
          </div>
        </LiquidGlass>
      </dialog>
    </header>
  );
}
