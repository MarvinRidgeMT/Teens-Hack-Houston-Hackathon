// "Hey Pickup" intent parser. Owner: Anish. Pure functions, no chrome.* calls,
// so the panel and the Node tests share one copy (test/voice.test.mjs).
// Rule-based only (keywords and regex): nothing here is a model.

export const INTENTS = Object.freeze([
  'whereWasI', 'resume', 'park', 'setNextStep', 'wrapUp', 'tidy', 'awayTime', 'today', 'stop', 'unknown',
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

// Order matters: "park it, next step ..." is park, "I'm done for today" is wrapUp, not today.
const RULES = [
  // Only at the start, so "next step is cancel the meeting" stays a next step.
  ['stop', /^\s*(?:stop\s+listening|never\s*mind|cancel)\b|^\s*stop\s*[.!]?\s*$/i],
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
    if (intent === 'park' || intent === 'setNextStep' || intent === 'wrapUp') {
      const m = s.match(NEXT_STEP);
      const words = m ? tidyWords(m[1]) : '';
      if (words) args.nextStep = words;
    }
    return { intent, args };
  }
  return { intent: 'unknown', args: {} };
}
