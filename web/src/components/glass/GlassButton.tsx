import { useEffect, useRef, type ReactNode, type MouseEventHandler } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { SPRING_PRESS } from '../../styles/motion';

type Tone = 'mint' | 'blush' | 'pearl' | 'quiet';
type Size = 'md' | 'lg';

type Common = {
  tone?: Tone;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  /** A small magnetic pull toward a fine pointer (≤ 6px within 80px). Primary CTAs only. */
  magnetic?: boolean;
  className?: string;
};
type AsLink = Common & { href: string; onClick?: MouseEventHandler<HTMLAnchorElement>; target?: string; rel?: string };
type AsButton = Common & { href?: undefined; onClick?: MouseEventHandler<HTMLButtonElement>; disabled?: boolean; type?: 'button' | 'submit'; 'aria-pressed'?: boolean };

const REACH = 80;
const PULL = 6;

function useMagnet(enabled: boolean) {
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20 });
  const sy = useSpring(y, { stiffness: 260, damping: 20 });
  useEffect(() => {
    if (!enabled) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine) return;
    const on = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + REACH && Math.abs(dy) < r.height / 2 + REACH;
      x.set(near ? Math.max(-PULL, Math.min(PULL, dx * 0.08)) : 0);
      y.set(near ? Math.max(-PULL, Math.min(PULL, dy * 0.12)) : 0);
    };
    addEventListener('pointermove', on, { passive: true });
    return () => removeEventListener('pointermove', on);
  }, [enabled, x, y]);
  return { ref, sx, sy };
}

/**
 * The gel button. Hover: highlight brightens and it lifts 2px. Press: scale 0.96 and spring back.
 * The label moves with the button, never relative to it. Spec highlight follows the pointer.
 */
export function GlassButton(props: AsLink | AsButton) {
  const { tone = 'pearl', size = 'md', icon, children, magnetic = false, className = '' } = props;
  const { ref, sx, sy } = useMagnet(magnetic);
  const cls = `gbtn gbtn--${tone} gbtn--${size} ${className}`;
  const motionProps = {
    style: { x: sx, y: sy },
    whileHover: { y: -2 },
    whileTap: { scale: 0.96 },
    transition: SPRING_PRESS,
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    },
  };
  const inner = (
    <>
      <span className="gbtn__shine" aria-hidden="true" />
      {icon && <span className="gbtn__icon" aria-hidden="true">{icon}</span>}
      <span className="gbtn__label">{children}</span>
    </>
  );
  if (props.href !== undefined) {
    return (
      <motion.a ref={ref as React.Ref<HTMLAnchorElement>} className={cls} href={props.href} onClick={props.onClick}
        target={props.target} rel={props.rel} {...motionProps}>
        {inner}
      </motion.a>
    );
  }
  return (
    <motion.button ref={ref as React.Ref<HTMLButtonElement>} className={cls} type={props.type ?? 'button'} onClick={props.onClick}
      disabled={props.disabled} aria-pressed={props['aria-pressed']} {...motionProps}>
      {inner}
    </motion.button>
  );
}
