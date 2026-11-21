// Calm colours: sets data-calm on <html> from settings.calm and keeps it in step.
// Loaded by the popup, setup, dashboard and side panel (<script type="module">).
// Not used by the content-script card. Owner: Anish.

const apply = (settings) => document.documentElement.toggleAttribute('data-calm', !!(settings && settings.calm));

if (globalThis.chrome && chrome.storage) {
  chrome.storage.local.get('settings').then(({ settings }) => apply(settings)).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) apply(changes.settings.newValue);
  });
}
