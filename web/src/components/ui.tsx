import type { ReactNode } from 'react';

/** PickUp's brand tile: a soft lavender gel square with a plum pill near its bottom edge. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <span className="pk-mark" style={{ width: size, height: size }} aria-hidden="true" />;
}

/** Keycaps for a shortcut. Pass the key names; "Alt" "P" renders as two caps joined by a plus. */
export function ShortcutHint({ keys, label }: { keys: readonly string[]; label?: string }) {
  if (!keys.length) return null;
  return (
    <span className="keys" role="img" aria-label={label ?? keys.join(' + ')}>
      {keys.map((k, i) => (
        <span key={k + i} className="keys" aria-hidden="true">
          {i > 0 && <span className="keys__plus">+</span>}
          <kbd className="keycap">{k}</kbd>
        </span>
      ))}
    </span>
  );
}

/** A section heading block: optional small label, the h2, an optional lede. */
export function SectionHead({ id, label, title, lede, align = 'start' }: {
  id: string; label?: string; title: ReactNode; lede?: ReactNode; align?: 'start' | 'center';
}) {
  return (
    <header className={`shead shead--${align}`}>
      {label && <p className="label shead__label">{label}</p>}
      <h2 id={id} className="h2">{title}</h2>
      {lede && <p className="lede shead__lede">{lede}</p>}
    </header>
  );
}
