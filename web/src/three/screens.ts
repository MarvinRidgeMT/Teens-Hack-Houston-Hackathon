// Builds the laptop's screen images: a drawn browser frame around the real product
// screenshots (assets/shot-*.jpg, taken from the extension in Chrome for Testing).
// The frame is illustration; the page and Pickup UI inside it are real captures.
import type { Screen } from './story';

const W = 1600;
const H = 1000;
const CHROME = 58;

const SHOTS: Record<Screen, string[]> = {
  leave: ['assets/shot-leave.jpg'],
  drift: ['assets/shot-resume.jpg', 'assets/shot-panel.jpg'],
  card: ['assets/shot-card.jpg'],
  resume: ['assets/shot-resume.jpg'],
};

const TABS: Record<Screen, { title: string; active?: boolean; grouped?: boolean }[]> = {
  leave: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
    { title: 'Video: lo-fi beats' },
  ],
  drift: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
  ],
  card: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
  ],
  resume: [
    { title: 'Climate essay: draft', active: true, grouped: true },
    { title: 'Reservoir levels 2023', grouped: true },
    { title: 'Later (2)' },
  ],
};

const cache = new Map<string, Promise<HTMLImageElement>>();
function load(src: string) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
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
  ctx.fillStyle = '#e8e6f1';
  ctx.fillRect(0, 0, W, CHROME);
  // window dots
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(26 + i * 22, 29, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  let x = 104;
  const groupStart = x;
  let groupEnd = x;
  ctx.font = '500 17px Inter, system-ui, sans-serif';
  for (const tab of TABS[screen]) {
    const w = Math.min(300, ctx.measureText(tab.title).width + 64);
    if (tab.active) {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x, 10, w, CHROME - 10, 12);
      ctx.fill();
    }
    ctx.fillStyle = tab.active ? '#121126' : '#4d4b66';
    ctx.fillText(tab.title, x + 22, 40);
    if (tab.grouped) groupEnd = x + w;
    x += w + 6;
  }
  // task tab group underline (Pickup names the task's tab group)
  ctx.fillStyle = '#6038ff';
  roundRect(ctx, groupStart, CHROME - 4, groupEnd - groupStart, 4, 2);
  ctx.fill();
}

export async function drawScreen(screen: Screen): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const [page, side] = await Promise.all(SHOTS[screen].map(load));
  const pageW = side ? W - 360 : W;
  // cover-fit the page shot, top aligned
  const scale = Math.max(pageW / page.width, (H - CHROME) / page.height);
  ctx.drawImage(page, 0, 0, pageW / scale, (H - CHROME) / scale, 0, CHROME, pageW, H - CHROME);
  if (side) {
    ctx.fillStyle = '#121126';
    ctx.fillRect(pageW, CHROME, W - pageW, H - CHROME);
    const s = (W - pageW) / side.width;
    ctx.drawImage(side, pageW, CHROME, W - pageW, side.height * s);
  }
  drawChrome(ctx, screen);
  return canvas;
}

export const SCREEN_ALT: Record<Screen, string> = {
  card: "Pickup's return card over a student's essay draft: welcome back to Climate Essay, the next step the student wrote, the sentence they last highlighted, and Resume, Tidy and Not now.",
  leave: 'The park prompt on the essay page: one line asking for your next step, with Enter to park it.',
  drift: 'The essay page with the Pickup side panel open: asked "where was I?", it answers with the task, the next step and the last highlight.',
  resume: 'The essay page after Resume: scrolled back to the saved spot with the highlighted sentence in view.',
};
