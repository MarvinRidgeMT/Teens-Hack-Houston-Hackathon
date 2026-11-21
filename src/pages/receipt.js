// Pickup F6: "Save comeback receipt". Draws a PNG on a <canvas> in the V4 light (Pearl) theme
// and downloads it with <a download>. No permission, no upload. Owner: Abhinav (pages).
// The words come from receiptText() in stats.js (non-debug events only).

import { receiptText, weekStart } from '../shared/stats.js';

// Light theme tokens (src/shared/tokens.css). The image is always light so it reads
// the same wherever it is shared.
const C = {
  // V4 light palette (design/tokens.json "v4.light"): canvas, pearl, lavender, plum text.
  paper: '#f8f5ff', surface: '#fdfbff', mist: '#efe7ff', ink: '#302545', inkBody: '#554868',
  border: 'rgba(48, 37, 69, 0.12)', accent: '#5a3cc4', onAccent: '#ffffff', periwinkle: '#5a3cc4', saved: '#2c6b4c',
};
const FONT = '"Geist", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
const W = 1200;
const H = 630;
const SCALE = 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word wrap; returns the lines. A number stays on the line with its unit ("1 h 4 m",
// "19 s", "n = 18 / 18").
const KEEP = '\u00a0';
function wrap(ctx, text, maxWidth) {
  const glued = String(text)
    .replace(/(\d) (h|m|s)\b/g, `$1${KEEP}$2`)
    .replace(/(\d\u00a0h) (\d)/g, `$1${KEEP}$2`)
    .replace(/n = (\d+) \/ (\d+)/g, `n${KEEP}=${KEEP}$1${KEEP}/${KEEP}$2`);
  const words = glued.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawReceipt(events, now = Date.now()) {
  const t = receiptText(events, now);
  if (document.fonts) {
    try { await document.fonts.load(`600 40px ${FONT}`); await document.fonts.load(`400 22px ${FONT}`); await document.fonts.ready; } catch { /* system font */ }
  }
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  // Ground and card
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.shadowColor = 'rgba(18, 17, 38, 0.10)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, 48, 48, W - 96, H - 96, 32);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, 48, 48, W - 96, H - 96, 32);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const x = 104;
  let y = 104;

  // Brand tile + wordmark
  roundRect(ctx, x, y, 48, 48, 12);
  ctx.fillStyle = C.accent;
  ctx.fill();
  roundRect(ctx, x + 6, y + 48 - 7 - 9, 36, 9, 4.5);
  ctx.fillStyle = C.onAccent;
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText('Pickup', x + 64, y + 34);

  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = C.inkBody;
  const weekOf = new Date(weekStart(now)).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const label = `Comeback receipt · week of ${weekOf}`;
  ctx.fillText(label, W - 104 - ctx.measureText(label).width, y + 32);

  // Headline
  y += 112;
  ctx.font = `600 38px ${FONT}`;
  ctx.fillStyle = C.ink;
  const maxW = W - 2 * x;
  for (const line of wrap(ctx, t.headline, maxW)) { ctx.fillText(line, x, y); y += 50; }

  // Not enough data, or the IQR in small text
  y += 8;
  if (t.comparison) {
    ctx.font = `400 24px ${FONT}`;
    const lines = wrap(ctx, t.comparison, maxW - 40);
    const boxH = lines.length * 34 + 28;
    roundRect(ctx, x, y - 4, maxW, boxH, 16);
    ctx.fillStyle = C.mist;
    ctx.fill();
    ctx.fillStyle = C.ink;
    let ly = y + 32;
    for (const line of lines) { ctx.fillText(line, x + 20, ly); ly += 34; }
    y += boxH + 12;
  }
  if (t.iqr) {
    ctx.font = `400 20px ${FONT}`;
    ctx.fillStyle = C.inkBody;
    for (const line of wrap(ctx, t.iqr, maxW)) { ctx.fillText(line, x, y); y += 28; }
  }

  // Footer: saved dot + "Your data, on your device"
  const fy = H - 104;
  ctx.beginPath();
  ctx.arc(x + 5, fy - 6, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.saved;
  ctx.fill();
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = C.inkBody;
  ctx.fillText(t.footer, x + 20, fy);

  return { canvas, text: t };
}

export function downloadCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('the image could not be made')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      resolve(filename);
    }, 'image/png');
  });
}
