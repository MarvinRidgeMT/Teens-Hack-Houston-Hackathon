// F2 "You were here": find the saved highlight on the page again. Owner: Anish.
// Pure functions, no DOM and no imports, so the content script can copy them
// as they are (content scripts aren't modules). Tested in test/features.test.mjs.
//
// The content script walks the page's text nodes with a TreeWalker, joins their
// text into one string with no separator (remembering where each node starts), calls
// locateHighlight, then turns the start/end indexes back into a Range with
// rawIndexToNode and marks it with the CSS Custom Highlight API. No match means:
// restore scrollY exactly as before, silently.

export const MIN_HIGHLIGHT = 3;           // shorter than this is not a real highlight
export const PREFIX_STEPS = [60, 40, 24]; // the text changed: try its start, shorter each time
export const MAX_HITS = 50;               // nearest-occurrence check looks at no more than this many

// Lower-case and drop all whitespace. A selection puts "\n" between paragraphs
// while the joined text nodes have nothing there, so whitespace can't be trusted.
// map[i] = index in `raw` of normalised char i.
export function normalise(raw) {
  const s = String(raw || '');
  let text = '';
  const map = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch)) continue;
    const lo = ch.toLowerCase();
    text += lo.length === 1 ? lo : ch; // keep length 1:1 with map
    map.push(i);
  }
  return { text, map };
}

function allIndexes(hay, needle) {
  const hits = [];
  for (let i = hay.indexOf(needle); i !== -1 && hits.length < MAX_HITS; i = hay.indexOf(needle, i + 1)) hits.push(i);
  return hits;
}

// raw: the page's text nodes joined with no separator. highlight: the saved text
// (up to 200 chars). yAt(rawIndex) -> page y of that character; savedY: saved scrollY.
// Returns { start, end, kind: 'full' | 'prefix' } in raw indexes (end exclusive), or null.
export function locateHighlight(raw, highlight, { yAt = () => 0, savedY = 0 } = {}) {
  const needle = normalise(highlight).text;
  if (needle.length < MIN_HIGHLIGHT) return null;
  const hay = normalise(raw);
  let kind = 'full';
  let len = needle.length;
  let hits = allIndexes(hay.text, needle);
  for (const n of PREFIX_STEPS) {
    if (hits.length) break;
    if (needle.length <= n) continue;
    hits = allIndexes(hay.text, needle.slice(0, n));
    kind = 'prefix';
    len = n;
  }
  if (!hits.length) return null;
  // Same text more than once: the one nearest where the user was.
  let best = hits[0];
  let bestD = Infinity;
  for (const h of hits) {
    const d = Math.abs(yAt(hay.map[h]) - savedY);
    if (d < bestD) { best = h; bestD = d; }
  }
  return { start: hay.map[best], end: hay.map[best + len - 1] + 1, kind };
}

// starts: ascending start index of each text node in the joined string.
// Returns { node, offset } for a raw index (the last node starting at or before it),
// or null with no nodes. For a Range end, map end - 1 and add 1 to the offset,
// so an end on a node boundary stays in the node it belongs to.
export function rawIndexToNode(starts, idx) {
  if (!starts || !starts.length) return null;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= idx) lo = mid; else hi = mid - 1;
  }
  return { node: lo, offset: idx - starts[lo] };
}

// Google Docs, Sheets and Slides draw on a canvas: there is no page text to search.
// The scroll restore still runs and the card already shows the highlight text.
export function canSearchText(url) {
  try { return new URL(url).hostname !== 'docs.google.com'; } catch { return true; }
}
