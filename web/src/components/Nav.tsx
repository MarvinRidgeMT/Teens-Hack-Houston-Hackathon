import { useEffect, useRef, useState } from 'react';
import { Menu, X, ArrowDownToLine } from 'lucide-react';
import { BrandMark } from './ui';

const ITEMS = [
  { href: '#how', label: 'How it works' },
  { href: '#try', label: 'Try it' },
  { href: '#features', label: 'Features' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#demo', label: 'Demo' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  // <dialog> gives us a focus trap, Esc to close and an inert page behind it.
  const open = () => dialog.current?.showModal();
  const close = () => {
    dialog.current?.close();
    opener.current?.focus();
  };

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <nav className="nav__bar" aria-label="Main">
        <a className="nav__brand" href="#top">
          <BrandMark size={26} tone="lime" />
          <span>Pickup</span>
        </a>
        <ul className="nav__links">
          {ITEMS.map((i) => (
            <li key={i.href}><a href={i.href}>{i.label}</a></li>
          ))}
        </ul>
        <a className="nav__cta" href="#install">
          <ArrowDownToLine size={16} aria-hidden="true" />
          Download
        </a>
        <button ref={opener} className="nav__menu" type="button" aria-label="Open menu" aria-haspopup="dialog" onClick={open}>
          <Menu size={20} aria-hidden="true" />
        </button>
      </nav>

      <dialog ref={dialog} className="sheet" aria-label="Menu" onClick={(e) => { if (e.target === dialog.current) close(); }} onClose={() => opener.current?.focus()}>
        <div className="sheet__inner">
          <div className="sheet__top">
            <span className="nav__brand"><BrandMark size={26} tone="lime" /> Pickup</span>
            <button className="nav__menu nav__menu--close" type="button" aria-label="Close menu" onClick={close} autoFocus>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <ul className="sheet__links">
            {ITEMS.map((i) => (
              <li key={i.href}><a href={i.href} onClick={close}>{i.label}</a></li>
            ))}
            <li><a href="#install" onClick={close} className="sheet__cta">Download</a></li>
          </ul>
        </div>
      </dialog>
    </header>
  );
}
