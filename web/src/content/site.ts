// Every claim on the page lives here so it can be checked against the extension in one place
// (PRODUCT.md "Capabilities and Constraints"). Edit copy here, not in the components.

export const LINKS = {
  // Works once the repo is public and a v1.0 release with the zip exists (it is private today).
  download: 'https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon/releases/latest',
  // Flip to true once the repo is public and the v1.0 release has the zip. Until then the page says so
  // instead of sending visitors to a 404.
  downloadLive: false,
  // The repo is private until release; links to it would 404 for visitors, so they stay hidden.
  repoPublic: false,
  repo: 'https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon',
  // DEVPOST: set the submission URL here when it exists; null shows "Devpost (coming)".
  devpost: null as string | null,
  // VIDEO: the unlisted YouTube id; null shows the "posted Saturday" placeholder. No autoplay.
  videoId: null as string | null,
};

// shortcuts-table:start (the only place on the site that names Pickup's keys; check-integration allows it)
// Must match manifest.json `suggested_key`: mac MacCtrl+Shift+P/R/V, everywhere else Alt+P/R/V.
export type Platform = 'mac' | 'other';
export type KeyId = 'park' | 'resume' | 'panel';
export const PLATFORM_KEYS: Record<Platform, Record<KeyId, readonly string[]>> = {
  mac: { park: ['⌃', '⇧', 'P'], resume: ['⌃', '⇧', 'R'], panel: ['⌃', '⇧', 'V'] },
  other: { park: ['Alt', 'P'], resume: ['Alt', 'R'], panel: ['Alt', 'V'] },
};
// shortcuts-table:end
export const PLATFORM_NAME: Record<Platform, string> = { mac: 'Mac', other: 'Windows, Linux, ChromeOS' };
const SPOKEN: Record<string, string> = { '⌃': 'Control', '⇧': 'Shift' };

/** Mac glyphs run together, other systems join with "+": for keys inside a sentence. */
export function keyText(platform: Platform, id: KeyId): string {
  return PLATFORM_KEYS[platform][id].join(platform === 'mac' ? '' : '+');
}
/** "Control + Shift + P": what a screen reader says for the key caps. */
export function keySpoken(platform: Platform, id: KeyId): string {
  return PLATFORM_KEYS[platform][id].map((k) => SPOKEN[k] ?? k).join(' + ');
}
/** Fills {park}, {resume} and {panel} in site copy with the visitor's keys. */
export function withKeys(text: string, platform: Platform): string {
  return text.replace(/\{(park|resume|panel)\}/g, (_, id: KeyId) => keyText(platform, id));
}

export const WORKS_ON = 'Chrome or Edge on Windows, Mac, Linux and ChromeOS. Not on phones: mobile browsers don\'t support extensions.';

export const NAV_ITEMS = [
  { href: '#story', label: 'How it works' },
  { href: '#return-card', label: 'Try the card' },
  { href: '#features', label: 'Features' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#install', label: 'Install' },
] as const;

export const HERO = {
  lede: 'A Chrome extension that remembers where you left off, so coming back feels easy.',
  facts: ['Free', 'No account', 'Nothing leaves your computer'],
  // The floating context objects use the extension's own words.
  task: { name: 'Climate Essay', meta: '3 tabs' },
  next: 'Find a source for the 2023 rainfall number',
  group: 'Climate Essay',
  away: 'Away 12 min',
};

/** The pinned story. Each scene drives the laptop screen, the camera and the caption. */
export const STORY = [
  {
    id: 'working',
    title: 'Working',
    body: 'An essay draft, three research tabs in a named tab group. You know exactly what comes next.',
    keys: [] as string[],
  },
  {
    id: 'interrupted',
    title: 'Interrupted',
    body: 'A message, a video, a quick look at something else. Pickup notices you left a work page. It never blocks the site.',
    keys: [] as string[],
  },
  {
    id: 'park',
    title: 'Park',
    body: 'Press {park} first and leave yourself one line: your next step, in your own words. Or skip it; your place is saved either way.',
    keys: [] as string[],
    key: 'park' as KeyId,
  },
  {
    id: 'return',
    title: 'Return',
    body: 'Come back and a small card shows the task, how long you were away, the next step you wrote and the sentence you were on.',
    keys: [] as string[],
  },
  {
    id: 'resume',
    title: 'Resume',
    body: 'Press Enter. You land on the same tab at the same spot. Press T and break tabs fold into a "Later" group. Nothing is closed.',
    keys: ['Enter'],
  },
] as const;

export const INSTALL_STEPS = [
  { title: 'Download the zip', body: 'From the GitHub release, then unzip it.' },
  { title: 'Open chrome://extensions', body: 'Paste it into Chrome\'s address bar.' },
  { title: 'Turn on Developer mode', body: 'The switch is at the top right.' },
  { title: 'Load unpacked', body: 'Pick the unzipped folder. The setup page opens: add your work sites and distraction sites.' },
] as const;

/** The install-section table lists both sets; `keys` is for keys that are the same everywhere. */
export const SHORTCUTS: readonly { id?: KeyId; keys?: readonly string[]; label: string; alt: string }[] = [
  { id: 'park', label: 'Park before you go', alt: 'or the Park button in the toolbar popup' },
  { id: 'resume', label: 'Back to your task from any tab', alt: 'or Resume in the popup' },
  { id: 'panel', label: 'Open the Pickup panel', alt: 'or the panel button in the popup' },
  { keys: ['Enter'], label: 'Resume, on the return card', alt: 'or click Resume' },
];
export const SHORTCUTS_NOTE = 'Change any of them at chrome://extensions/shortcuts. A new key only applies to a fresh install: if you had Pickup before, remove it and load the new version, or set the keys there.';

export const PRIVACY = [
  {
    title: 'Stays on this computer',
    short: "Everything Pickup saves sits in Chrome's local storage.",
    detail: 'Tasks, next steps and break times are kept in chrome.storage.local in your browser profile. The extension makes no network requests at all; our test suite fails the build if any file tries to.',
  },
  {
    title: 'No account, no servers, no analytics',
    short: 'Nothing to sign up for and nothing phoning home.',
    detail: 'There is no Pickup server. For our pilot, Pickup keeps a small event log (for example "came back after 7 min") in the same local storage. It only leaves your computer if you export it as a CSV yourself.',
  },
  {
    title: 'A highlight, never the page',
    short: 'At most 200 characters of the sentence you last highlighted.',
    detail: "Pickup stores the page's address, your scroll position and up to 200 characters you highlighted, so it can bring you back to them. It never stores the page's text. In Google Docs it can't read the text, so it saves your place without a highlight.",
  },
  {
    title: 'Voice is off unless you turn it on',
    short: 'Recognised on your device; no audio is kept.',
    detail: 'The optional voice panel only runs speech recognition in Chrome\'s on-device mode, and only after you turn it on. Spoken replies use voices installed on your computer.',
  },
  {
    title: 'One button deletes everything',
    short: 'Delete all removes every task, note and log entry.',
    detail: 'The dashboard has a Delete all button. It clears everything Pickup stored. It is the only thing in Pickup coloured red.',
  },
] as const;

export const LIMITS = [
  "Pickup can't see your phone. It only knows what happens in Chrome.",
  "It can't read the text of a Google Doc, so in Docs it saves your place but not your highlight.",
  '"Time to first interaction" (your first click, key or scroll back on the task) is a stand-in for getting back into work, not a measure of focus.',
];

// PILOT RESULTS: Abhinav fills these in Saturday ~10 AM with real numbers only. Leave null until then.
export const PILOT_RESULTS: null | { headline: string; detail: string } = null;

export const PILOT_METHOD = [
  { label: 'Who', value: 'Three of us, on our own laptops, during real homework sessions.' },
  { label: 'How', value: 'Each time someone comes back to a task, a coin flip decides whether Pickup shows its card or stays quiet (the control).' },
  { label: 'What we measure', value: 'Time to first interaction: how long until your first click, key or scroll back on the task.' },
  { label: 'What it is not', value: 'Not a study of focus or productivity. Three people is a pilot, not proof.' },
  // From test/REAL_CHROME_LOG.md (treatment log). Colours only each time; no behaviour, timing or schema changed.
  { label: 'Card version', value: 'The card\'s colours changed at 9:38 AM (v2) for both conditions; a laptop got it only after reloading Pickup, and none logged a reload. The 11:19 AM restyle (v3) came after the pilot closed at 10:00 AM.' },
];
