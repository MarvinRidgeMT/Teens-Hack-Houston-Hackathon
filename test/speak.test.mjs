// Pickup's voice: the pure text side (what gets said, in what pieces, when to give up).
// The audio side runs in real Chrome (test/dev/voice-out-check.mjs).
// Run: node test/speak.test.mjs

import assert from 'node:assert/strict';
import { speakableText, splitSentences, MAX_SENTENCES, firstSoundVerdict, SLOW_FIRST_SOUND_MS } from '../src/voice/speakable.js';

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.log(`  FAIL ${name}\n`, e); process.exitCode = 1; }
}

await step('speakableText: "min" becomes minutes (one minute singular), s and h too', () => {
  assert.equal(speakableText('Away 12 min from Climate Essay.'), 'Away 12 minutes from Climate Essay.');
  assert.equal(speakableText('Away 1 min.'), 'Away 1 minute.');
  assert.equal(speakableText('Median 9 s back to work.'), 'Median 9 seconds back to work.');
  assert.equal(speakableText('Gone 2 h.'), 'Gone 2 hours.');
  assert.equal(speakableText('A 25-min break.'), 'A 25 minute break.');
});

await step('speakableText: "·" is a pause, quotes are dropped', () => {
  assert.equal(speakableText('2 breaks · 9 s median'), '2 breaks, 9 seconds median');
  assert.equal(speakableText('Your next step: "find a source".'), 'Your next step: find a source.');
  assert.equal(speakableText('Next: “Write the intro”'), 'Next: Write the intro');
  assert.equal(speakableText("You're back."), "You're back.", 'apostrophes stay');
});

await step('speakableText: keys in words', () => {
  assert.equal(speakableText('Press ⌃⇧P to park.'), 'Press Control Shift P to park.');
  assert.equal(speakableText('Press Alt+P to park.'), 'Press Alt P to park.');
  assert.equal(speakableText('Press Ctrl+Shift+R.'), 'Press Control Shift R.');
});

await step('speakableText: URLs and hosts become the site name', () => {
  assert.equal(speakableText('You were on https://en.wikipedia.org/wiki/Drought.'), 'You were on Wikipedia.');
  assert.equal(speakableText('Most time away: youtube.com (12 min).'), 'Most time away: YouTube (12 minutes).');
  assert.equal(speakableText('Open docs.google.com/document/d/x'), 'Open Google Docs');
  assert.equal(speakableText('Try jstor.org'), 'Try jstor');
});

await step('speakableText: at most three sentences, whitespace tidied, empty stays empty', () => {
  assert.equal(speakableText('One. Two. Three. Four. Five.'), 'One. Two. Three.');
  assert.equal(MAX_SENTENCES, 3);
  assert.equal(speakableText('  Hello   there.  '), 'Hello there.');
  assert.equal(speakableText(''), '');
  assert.equal(speakableText(null), '');
});

await step('speakableText: times and decimals are not split as sentences', () => {
  assert.equal(speakableText('Back at 1:20 PM. Then write. Then rest. Extra.'), 'Back at 1:20 PM. Then write. Then rest.');
  assert.deepEqual(splitSentences('It is 2.5 hours. Done.'), ['It is 2.5 hours.', 'Done.']);
});

await step('splitSentences: one piece per sentence, keeps end punctuation, no empties', () => {
  assert.deepEqual(splitSentences('Welcome back. Your next step is to find a source.'), ['Welcome back.', 'Your next step is to find a source.']);
  assert.deepEqual(splitSentences('Really? Yes! Ok'), ['Really?', 'Yes!', 'Ok']);
  assert.deepEqual(splitSentences('   '), []);
});

await step('firstSoundVerdict: slow first sound twice turns talking back off; a fast one resets', () => {
  assert.equal(SLOW_FIRST_SOUND_MS, 6000);
  let v = firstSoundVerdict(0, 7000);
  assert.deepEqual(v, { slowCount: 1, giveUp: false });
  v = firstSoundVerdict(v.slowCount, 1200);
  assert.deepEqual(v, { slowCount: 0, giveUp: false });
  v = firstSoundVerdict(firstSoundVerdict(0, 6500).slowCount, 9000);
  assert.deepEqual(v, { slowCount: 2, giveUp: true });
});

console.log(`\n${passed} speak checks passed${process.exitCode ? ' — SOME FAILED' : ''}`);
