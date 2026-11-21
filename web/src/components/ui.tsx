import type { ReactNode, AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { motion } from 'motion/react';

/** Pickup's brand tile: a rounded square with a pill near its bottom edge. */
export function BrandMark({ size = 28, tone = 'violet' }: { size?: number; tone?: 'violet' | 'lime' | 'ink' }) {
  return <span className={`pk-mark pk-mark--${tone}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** A drawn keycap. Pass the key names; renders "Alt" "P" as two caps joined by a plus. */
export function Keys({ keys, label }: { keys: readonly string[]; label?: string }) {
  if (!keys.length) return null;
  return (
    <span className="keys" aria-label={label ?? keys.join(' + ')} role="img">
      {keys.map((k, i) => (
        <span key={k + i} className="keys__item" aria-hidden="true">
          {i > 0 && <span className="keys__plus">+</span>}
          <kbd className="keycap">{k}</kbd>
        </span>
      ))}
    </span>
  );
}

/** A highlighter stroke behind inline text, in one of the function colours. */
export function Mark({ children, tone = 'lime' }: { children: ReactNode; tone?: 'lime' | 'cyan' | 'pink' | 'yellow' }) {
  return <mark className={`hl hl--${tone}`}>{children}</mark>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'on-violet';

const press = { whileTap: { scale: 0.97 }, transition: { type: 'spring' as const, stiffness: 520, damping: 30 } };

export function ButtonLink({ variant = 'primary', children, icon, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <motion.a className={`btn btn--${variant}`} {...press} {...(rest as object)}>
      {icon}
      <span>{children}</span>
    </motion.a>
  );
}

export function Button({ variant = 'primary', children, icon, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <motion.button type="button" className={`btn btn--${variant}`} {...press} {...(rest as object)}>
      {icon}
      <span>{children}</span>
    </motion.button>
  );
}

export function SectionHead({ id, title, lede, tone }: { id: string; title: ReactNode; lede?: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <header className={`section-head ${tone === 'dark' ? 'section-head--dark' : ''}`}>
      <h2 id={id} className="h2">{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}
