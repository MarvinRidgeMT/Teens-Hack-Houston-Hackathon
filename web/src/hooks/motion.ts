import { useEffect, useState } from 'react';

const query = '(prefers-reduced-motion: reduce)';

/** True when the visitor asked for reduced motion; follows changes live. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

let webgl: boolean | null = null;
/** Probes WebGL once per page and releases the probe context (Chrome caps live contexts at ~16). */
function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    const ctx = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webgl = !!ctx;
    ctx?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { webgl = false; }
  return webgl;
}

/** True on wide screens with a fine pointer and WebGL: where the 3D stage is worth its cost. */
export function useCan3D() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(min-width: 900px)');
    const check = () => {
      const gl = hasWebGL();
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      setOk(mq.matches && gl && !saveData);
    };
    check();
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);
  return ok;
}
