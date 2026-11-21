import { createElement, useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

export type GlassVariant = 'pearl' | 'gel' | 'crystal';
export type GlassTint = 'none' | 'mint' | 'blush' | 'lilac';

type Props = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article' | 'aside' | 'li' | 'figure' | 'header' | 'nav';
  variant?: GlassVariant;
  tint?: GlassTint;
  /** Radius in px, or a CSS length. */
  radius?: number | string;
  /** Pointer-tracked specular highlight and hover lift. */
  interactive?: boolean;
  /** The surface carries body text: use the strong fill so contrast holds over anything. */
  text?: boolean;
  /** Where the highlight rests when the pointer isn't over it (percent, x/y). */
  rest?: [number, number];
  children?: ReactNode;
};

const fine = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches
  && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Moves the specular highlight toward the pointer (--mx/--my), one rAF per frame at most,
 * and lets it settle back to its rest position on leave. No React state per frame.
 */
export function useSpecular<T extends HTMLElement>(enabled: boolean, rest: [number, number]) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--mx', `${rest[0]}%`);
    el.style.setProperty('--my', `${rest[1]}%`);
    if (!enabled || !fine()) return;
    let raf = 0;
    let x = rest[0];
    let y = rest[1];
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = ((e.clientX - r.left) / r.width) * 100;
      y = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty('--mx', `${x.toFixed(1)}%`);
        el.style.setProperty('--my', `${y.toFixed(1)}%`);
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      el.style.setProperty('--mx', `${rest[0]}%`);
      el.style.setProperty('--my', `${rest[1]}%`);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [enabled, rest]);
  return ref;
}

const DEFAULT_REST: [number, number] = [24, 0];

/** The base glass surface. Every other glass component is this with a preset. */
export function LiquidGlass({
  as = 'div', variant = 'pearl', tint = 'none', radius, interactive = false, text = false,
  rest = DEFAULT_REST, className = '', style, children, ...rest_
}: Props) {
  const ref = useSpecular<HTMLElement>(interactive, rest);
  const cls = [
    'lg', `lg--${variant}`, tint !== 'none' && `lg--${tint}`, text && 'lg--text', interactive && 'lg--interactive', className,
  ].filter(Boolean).join(' ');
  const r = radius === undefined ? undefined : typeof radius === 'number' ? `${radius}px` : radius;
  const s: CSSProperties = r ? { ...style, ['--lg-r' as string]: r } : { ...style };
  return createElement(as, { ref, className: cls, style: s, ...rest_ },
    variant === 'crystal' ? <span className="lg__lens" aria-hidden="true" /> : null,
    children,
  );
}

/**
 * The SVG lens used by crystal glass in Chromium (backdrop-filter: url(#pk-lens)). Mounted once.
 * Feature-detected: only Chromium applies url() in backdrop-filter; elsewhere crystal keeps its
 * CSS rim and highlight. Text is never inside the refracted layer.
 */
export function GlassDefs() {
  useEffect(() => {
    // Chrome, Edge and other Chromium browsers all carry "Chrome/"; Safari and Firefox don't.
    const chromium = /Chrome\//.test(navigator.userAgent);
    const reducedT = matchMedia('(prefers-reduced-transparency: reduce)').matches;
    const ok = chromium && !reducedT && CSS.supports('backdrop-filter', 'url(#pk-lens)');
    document.documentElement.dataset.lens = ok ? 'on' : 'off';
  }, []);
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }} focusable="false">
      <filter id="pk-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="1" seed="7" result="n" />
        <feGaussianBlur in="n" stdDeviation="2" result="nb" />
        <feDisplacementMap in="SourceGraphic" in2="nb" scale="22" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
