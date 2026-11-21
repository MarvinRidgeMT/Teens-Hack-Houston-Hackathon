// Builds the laptop's screen images: a drawn browser frame around real product screenshots
// (assets/shot-*.jpg, captured from the extension in Chrome for Testing). The browser frame and the
// "video" page in the Interrupted scene are illustration; every Pickup UI inside is a real capture.
// Colours come from the CSS tokens (read at draw time), so this file holds no raw colour values.
import type { Screen } from './story';

const W = 2048;
const H = 1280;
const CHROME = 74;

const SHOTS: Partial<Record<Screen, string>> = {
  working: 'assets/shot-resume.jpg',
  interrupted: 'assets/shot-resume.jpg',
  park: 'assets/shot-leave.jpg',
  return: 'assets/shot-card.jpg',
  resume: 'assets/shot-resume.jpg',
};

type Tab = { title: string; active?: boolean; grouped?: boolean; later?: boolean };
const TABS: Record<Screen, Tab[]> = {
  working: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
    { title: 'Drought statistics', grouped: true },
  ],
  interrupted: [
    { title: 'Climate essay: draft', grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
    { title: 'Drought statistics', grouped: true },
    { title: 'Video: lo-fi beats', active: true },
  ],
  park: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
    { title: 'Drought statistics', grouped: true },
  ],
  return: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
    { title: 'Drought statistics', grouped: true },
    { title: 'Video: lo-fi beats' },
  ],
  resume: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
    { title: 'Drought statistics', grouped: true },
    { title: 'Later (1)', later: true },
  ],
};

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const cache = new Map<string, Promise<HTMLImageElement>>();
function load(src: string) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`screen image failed to load: ${src}`));
      img.src = src;
    }));
  }
  return cache.get(src)!;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawChrome(ctx: CanvasRenderingContext2D, screen: Screen) {
  ctx.fillStyle = css('--canvas-2');
  ctx.fillRect(0, 0, W, CHROME);
  [css('--bubblegum'), css('--peach'), css('--green-2')].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(34 + i * 28, 37, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  let x = 134;
  let groupStart = -1;
  let groupEnd = -1;
  ctx.font = `560 22px ${css('--font-ui')}`;
  for (const tab of TABS[screen]) {
    const w = Math.min(360, ctx.measureText(tab.title).width + 70);
    if (tab.active) {
      ctx.fillStyle = css('--surface-elevated');
      roundRect(ctx, x, 12, w, CHROME - 12, 16);
      ctx.fill();
    }
    if (tab.later) {
      ctx.fillStyle = css('--lavender');
      roundRect(ctx, x + 6, 20, w - 12, CHROME - 30, 12);
      ctx.fill();
    }
    ctx.fillStyle = tab.active ? css('--plum') : css('--plum-2');
    ctx.fillText(tab.title, x + 28, 50);
    if (tab.grouped) { if (groupStart < 0) groupStart = x; groupEnd = x + w; }
    x += w + 8;
  }
  if (groupStart >= 0) {
    // the task's named Chrome tab group
    ctx.fillStyle = css('--green-2');
    roundRect(ctx, groupStart, CHROME - 6, groupEnd - groupStart, 6, 3);
    ctx.fill();
  }
}

/** The Interrupted scene's page: an illustrated video tab (not Pickup UI). */
function drawVideo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = css('--plum');
  ctx.fillRect(0, CHROME, W, H - CHROME);
  const vw = 1300;
  const vh = vw * 9 / 16;
  const vx = (W - vw) / 2;
  const vy = CHROME + 70;
  const g = ctx.createLinearGradient(vx, vy, vx + vw, vy + vh);
  g.addColorStop(0, css('--bubblegum'));
  g.addColorStop(1, css('--peach'));
  ctx.fillStyle = g;
  roundRect(ctx, vx, vy, vw, vh, 28);
  ctx.fill();
  ctx.fillStyle = css('--pearl');
  ctx.beginPath();
  ctx.moveTo(W / 2 - 40, vy + vh / 2 - 52);
  ctx.lineTo(W / 2 + 60, vy + vh / 2);
  ctx.lineTo(W / 2 - 40, vy + vh / 2 + 52);
  ctx.closePath();
  ctx.fill();
  ctx.font = `680 40px ${css('--font-ui')}`;
  ctx.fillText('lo-fi beats to study to', vx, vy + vh + 70);
}

export async function drawScreen(screen: Screen): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = css('--surface-elevated');
  ctx.fillRect(0, 0, W, H);
  if (screen === 'interrupted') {
    drawVideo(ctx);
  } else {
    const page = await load(SHOTS[screen]!);
    // cover-fit the page shot, top aligned
    const scale = Math.max(W / page.width, (H - CHROME) / page.height);
    ctx.drawImage(page, 0, 0, W / scale, (H - CHROME) / scale, 0, CHROME, W, H - CHROME);
  }
  drawChrome(ctx, screen);
  return canvas;
}

export const SCREEN_ALT: Record<Screen, string> = {
  working: 'A browser on the laptop with a student\'s essay draft open and three research tabs in a named tab group.',
  interrupted: 'The student has switched to a video tab; the essay\'s tab group is still there.',
  park: 'Pickup\'s park prompt on the essay page: one line asking for the next step, with Enter to park it.',
  return: 'Pickup\'s return card over the essay: welcome back to Climate Essay, time away, the next step the student wrote, the highlighted sentence, and Resume, Tidy and Not now.',
  resume: 'The essay after Resume: back at the saved spot, with the video tab folded into a "Later" group.',
};
