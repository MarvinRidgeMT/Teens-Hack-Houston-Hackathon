// Every claim on the page lives here so it can be checked against the extension in one place
// (PRODUCT.md "Capabilities and Constraints"). Edit copy here, not in the components.

export const LINKS = {
  // Works once the repo is public and a v1.0 release with the zip exists (it is private today).
  download: 'https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon/releases/latest',
  repo: 'https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon',
  // DEVPOST: set the submission URL here when it exists; null shows "Devpost (coming)".
  devpost: null as string | null,
  // VIDEO: the unlisted YouTube id; null shows the "posted Saturday" placeholder. No autoplay.
  videoId: null as string | null,
};

export const WALKTHROUGH = [
  {
    id: 'leave',
    title: 'Leave',
    keys: ['Alt', 'P'],
    body: 'Switch away from a work page and Pickup saves where you were: the page, your scroll position and what you last highlighted. Press Alt+P first to leave a next step in your own words.',
  },
  {
    id: 'drift',
    title: 'Drift',
    keys: ['Alt', 'V'],
    body: 'If you wrote a next step, Pickup can send one quiet reminder after a few minutes away. One per break, never more, and it never blocks a site. Ask the Pickup panel "where was I?" any time.',
  },
  {
    id: 'return',
    title: 'Return',
    keys: [],
    body: 'Come back and a small card shows what you were doing, how long you were gone, and the next step you wrote. Every line is something you did or wrote.',
  },
  {
    id: 'resume',
    title: 'Resume',
    keys: ['Enter'],
    body: "Press Enter and you're back at the exact spot. Press T to tidy the tabs you opened while away into a collapsed \"Later\" group. Nothing is closed.",
  },
] as const;

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
];
