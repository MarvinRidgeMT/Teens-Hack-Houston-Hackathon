// "Hey Pickup" intent parser. Owner: Anish. Pure functions, no chrome.* calls,
// so the panel and the Node tests share one copy (test/voice.test.mjs).
// Rule-based only (keywords and regex): nothing here is a model.

export const INTENTS = Object.freeze([
  'whereWasI', 'resume', 'park', 'setNextStep', 'wrapUp', 'tidy', 'awayTime', 'today', 'stop',
  'breakTimer', 'cancelBreak', 'unknown',
]);

// Wake phrase: "hey pickup", "hey pick up", or plain "pick up" / "pickup".
const WAKE = /\b(?:hey,?\s+)?pick\s?-?up\b[\s,.!?:;-]*/i;

// Find the wake phrase. Returns { wake: false } or { wake: true, rest } where
// rest is what was said after it (the command, possibly empty).
export function splitWake(text) {
  const s = String(text || '');
  const m = s.match(WAKE);
  if (!m) return { wake: false, rest: '' };
  return { wake: true, rest: tidyWords(s.slice(m.index + m[0].length)) };
}

// Wake-word mode: only a wake phrase that starts what was heard counts, so
// "can you pick up the kids, park it" is not a command.
const WAKE_AT_START = /^(?:hey,?\s+)?pick\s?-?up\b/i;
export function wakeCommand(text) {
  const s = tidyWords(text);
  return WAKE_AT_START.test(s) ? splitWake(s) : { wake: false, rest: '' };
}

// Trim spaces and trailing punctuation the recogniser adds; keep the user's words.
export function tidyWords(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/^[\s,.!?:;-]+|[\s,.!?:;-]+$/g, '').trim();
}

const NEXT_STEP = /\bnext\s+step\b(?:\s+is\b)?[\s,.:;-]*(.*)$/i;

// ---------- break timer ("back in 10") ----------
export const BREAK_MIN = 1;
export const BREAK_MAX = 120;
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
// Number words one..ninety-nine -> digits; "half an hour" = 30, "an hour" = 60,
// "an hour and a half" = 90, "N hours" / "1.5 hours" = N*60.
export function numbersToDigits(text) {
  let s = ` ${String(text || '').toLowerCase()} `;
  s = s.replace(/\b(?:an|one)\s+(?:hour\s+and\s+a\s+half|and\s+a\s+half\s+hours?)\b/g, '90 minutes');
  s = s.replace(/\b(?:half\s+an\s+hour|a\s+half\s+hour)\b/g, '30 minutes');
  s = s.replace(/\b(?:an|one)\s+hour\b/g, '60 minutes');
  s = s.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g,
    (_, t, o) => String(TENS[t] + ONES.indexOf(o)));
  s = s.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (_, t) => String(TENS[t]));
  s = s.replace(new RegExp(`\\b(${ONES.slice(1).join('|')})\\b`, 'g'), (_, w) => String(ONES.indexOf(w)));
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*hours?\b/g, (_, n) => `${Math.round(Number(n) * 60)} minutes`);
  return s.trim();
}
const MIN = String.raw`(?:m|mins?|minutes?)\b`;
const BREAK_RES = [
  new RegExp(String.raw`\bback\s+in\s+(\d+)\b`),
  new RegExp(String.raw`\bbreak\s+for\s+(\d+)\b`),
  new RegExp(String.raw`\b(\d+)[\s-]*${MIN}[\s-]+break\b`),
  new RegExp(String.raw`\bgive\s+me\s+(\d+)\s*(?:more\s+)?${MIN}`),
  new RegExp(String.raw`\b(?:set|start)\s+(?:a\s+)?(?:break\s+)?timer\s+for\s+(\d+)\b`),
];
// -> minutes (number), NaN for a break phrase with an unusable number, or null.
export function breakMinutes(text) {
  const s = numbersToDigits(text);
  for (const re of BREAK_RES) {
    const m = s.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

// Order matters: "park it, next step ..." is park, "I'm done for today" is wrapUp, not today.
const RULES = [
  // Only at the start, so "next step is cancel the meeting" stays a next step.
  // Only at the start, so a next step like "cancel the break room booking" stays a next step.
  ['cancelBreak', /^\s*(?:cancel|stop|end)\s+(?:the\s+|my\s+)?(?:break(?:\s+timer)?|timer)\b|^\s*(?:i'?m|i\s+am)\s+back\s+early\b/i],
  ['stop', /^\s*(?:stop\s+listening|never\s*mind|cancel)\b|^\s*stop\s*[.!]?\s*$/i],
  // Only outside a next step: "park it, next step call them back in 10" is park.
  ['breakTimer', { test: (s) => breakMinutes(s.replace(NEXT_STEP, '')) !== null }],
  ['park', /\bpark\b|\b(?:i'?m|i\s+am)\s+taking\s+a\s+break\b|\btake\s+a\s+break\b/i],
  ['setNextStep', /^\s*(?:(?:my|the)\s+)?next\s+step\b/i],
  ['wrapUp', /\bwrap(?:\s+it)?\s+up\b|\bwrapping\s+up\b|\b(?:i'?m|i\s+am)\s+done\s+for\s+(?:today|the\s+day|now)\b/i],
  ['whereWasI', /\bwhere\s+was\s+i\b|\bwhat\s+was\s+i\s+doing\b|\bwhat'?s\s+next\b|\bwhat\s+is\s+next\b|\bwhere\s+am\s+i\b/i],
  ['resume', /\btake\s+me\s+back\b|\b(?:i'?m|i\s+am)\s+back\b|\bresume\b|\blet'?s\s+go\b|\bgo\s+back\b/i],
  ['tidy', /\btidy\b/i],
  ['awayTime', /\bhow\s+long\s+(?:was|have|had)\s+i\s+(?:been\s+)?(?:away|gone)\b/i],
  ['today', /\bhow\s+am\s+i\s+doing\b|\btoday\b/i],
];

// parse(text) -> { intent, args }. args.nextStep is set (the user's own words)
// for park and setNextStep when they said one.
export function parse(text) {
  const s = tidyWords(text);
  if (!s) return { intent: 'unknown', args: {} };
  for (const [intent, re] of RULES) {
    if (!re.test(s)) continue;
    const args = {};
    if (intent === 'cancelBreak' && /\bback\s+early\b/i.test(s)) args.early = true;
    if (intent === 'breakTimer') {
      const n = breakMinutes(s.replace(NEXT_STEP, ''));
      if (Number.isInteger(n) && n >= BREAK_MIN && n <= BREAK_MAX) args.minutes = n;
    }
    if (intent === 'park' || intent === 'setNextStep' || intent === 'wrapUp' || intent === 'breakTimer') {
      const m = s.match(NEXT_STEP);
      const words = m ? tidyWords(m[1]) : '';
      if (words) args.nextStep = words;
    }
    return { intent, args };
  }
  return { intent: 'unknown', args: {} };
}
