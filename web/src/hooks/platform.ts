import { useSyncExternalStore } from 'react';
import type { Platform } from '../content/site';

// Which keys the page shows: Mac visitors get ⌃⇧, everyone else Alt. The toggle on the page
// switches it for every key hint at once. The prerender (no navigator) uses 'other'.
let current: Platform | null = null;
const listeners = new Set<() => void>();

function detect(): Platform {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /mac|iphone|ipad/i.test(p) ? 'mac' : 'other';
}
function get(): Platform {
  if (current === null) current = detect();
  return current;
}
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function setPlatform(p: Platform): void {
  current = p;
  listeners.forEach((fn) => fn());
}
/** The platform whose keys to show; re-renders when the toggle changes it. */
export function usePlatform(): Platform {
  return useSyncExternalStore(subscribe, get, () => 'other');
}
