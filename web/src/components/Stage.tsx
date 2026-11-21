import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useCan3D } from '../hooks/motion';
import type { Margin } from '../three/rig';

const LaptopScene = lazy(() => import('../three/LaptopScene'));

/** The 2D laptop: first paint, the no-WebGL / Save-Data fallback, mobile, and reduced motion story panels. */
export function DeviceFrame({ src, alt, poster = false, children }: { src: string; alt: string; poster?: boolean; children?: ReactNode }) {
  if (poster) {
    return (
      <figure className="device device--poster">
        <img src="assets/laptop/laptop-poster.webp" alt={alt} width={2560} height={1600} decoding="async"
          onError={(e) => { (e.currentTarget.closest('figure') as HTMLElement).classList.add('device--noposter'); }} />
        <div className="device__fallback">
          <div className="device__lid"><img src={src} alt="" width={1600} height={1000} /></div>
          <div className="device__base" />
        </div>
      </figure>
    );
  }
  return (
    <figure className="device">
      <div className="device__lid"><img src={src} alt={alt} width={1600} height={1000} loading="lazy" decoding="async" /></div>
      <div className="device__base" aria-hidden="true" />
      {children}
    </figure>
  );
}

/** Live 3D when the device can afford it; the 2D frame otherwise or if WebGL dies. */
export function LaptopStage({ mode, reduced, margin, fallback }: { mode: 'hero' | 'story'; reduced: boolean; margin: Margin; fallback: ReactNode }) {
  const can3D = useCan3D();
  const [failed, setFailed] = useState(false);
  if (!can3D || failed) return <>{fallback}</>;
  return (
    <Suspense fallback={fallback}>
      <LaptopScene mode={mode} reduced={reduced} margin={margin} onFail={() => setFailed(true)} />
    </Suspense>
  );
}
