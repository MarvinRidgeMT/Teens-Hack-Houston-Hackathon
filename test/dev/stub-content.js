// =====================================================================
// DEV STUB, NOT SIDD'S CODE.
// The smallest content script that follows the engine contract (handoff PDF
// Section 2), so the engine can be tested in real Chrome before Sidd's
// src/content/ lands. Plain unstyled card, prompt() instead of an overlay.
// Lives in test/dev/ and is never shipped. Owner: Anish (Engine).
// =====================================================================
(() => {
  if (window.__pickupDevStub) return; // injected twice (registered + executeScript)
  window.__pickupDevStub = true;

  const MSG = {
    snapshot: 'snapshot', showCard: 'showCard', armTimer: 'armTimer',
    restoreScroll: 'restoreScroll', openOverlay: 'openOverlay',
    state: 'state', firstInteraction: 'firstInteraction',
    cardAction: 'cardAction', parkNote: 'parkNote',
  };
  const TOP = window === window.top;
  const HIGHLIGHT_MAX = 200;
  const log = (...a) => console.log('[Pickup DEV STUB]', ...a);

  async function send(msg) {
    try { return await chrome.runtime.sendMessage(msg); } catch (e) { log('send failed', msg.type, e.message); return null; }
  }

  // ---- where the user is ----
  const docsEditor = () => document.querySelector('.kix-appview-editor');
  function currentScroll() {
    const ed = docsEditor();
    return Math.round(ed ? ed.scrollTop : window.scrollY);
  }
  let lastHighlight = '';
  function currentHighlight() {
    const sel = String((window.getSelection && window.getSelection()) || '').trim();
    if (sel) lastHighlight = sel.slice(0, HIGHLIGHT_MAX);
    return lastHighlight;
  }

  // ---- state, debounced 2 s (top frame only) ----
  let stateTimer = null;
  function queueState() {
    clearTimeout(stateTimer);
    stateTimer = setTimeout(() => {
      send({ type: MSG.state, url: location.href, scrollY: currentScroll(), highlight: currentHighlight() });
    }, 2000);
  }
  if (TOP) {
    window.addEventListener('scroll', queueState, { capture: true, passive: true });
    document.addEventListener('selectionchange', () => { currentHighlight(); queueState(); });
  }

  // ---- card (top frame only) ----
  let card = null;
  let cardEventId = null;
  const CARD_KEYS = new Set(['Enter', 't', 'T', 'Escape']);

  function closeCard() { if (card) card.remove(); card = null; cardEventId = null; }
  function act(action) {
    const eventId = cardEventId;
    closeCard();
    send({ type: MSG.cardAction, eventId, action });
  }
  function line(text) { const p = document.createElement('div'); p.textContent = text; return p; }

  function showCard(msg) {
    closeCard();
    cardEventId = msg.eventId;
    card = document.createElement('div');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Pickup dev stub card');
    card.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#fff;color:#000;border:2px solid #000;padding:8px;font:13px monospace;max-width:360px;';
    card.append(
      line('DEV STUB CARD (not Sidd\'s)'),
      line(`Task: ${msg.threadName}`),
      line(`Away: ${Math.round(msg.awayMs / 1000)} s`),
    );
    if (msg.nextStep) card.append(line(`Your next step (you wrote this): ${msg.nextStep}`));
    if (msg.where && msg.where.highlight) card.append(line(`Where: "${msg.where.highlight}"`));
    card.append(line(`Scroll: ${msg.where ? msg.where.scrollY : 0} · Tabs: ${msg.tabCount}`));
    const row = document.createElement('div');
    for (const [label, action] of [['Resume (Enter)', 'resume'], ['Tidy (T)', 'tidy'], ['Not now (Esc)', 'notNow']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => act(action));
      row.append(b);
    }
    card.append(row);
    document.documentElement.append(card);
    row.firstChild.focus();
  }

  if (TOP) {
    window.addEventListener('keydown', (e) => {
      if (!card || !CARD_KEYS.has(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation(); // also keeps the armTimer listener from counting this key
      act(e.key === 'Enter' ? 'resume' : e.key === 'Escape' ? 'notNow' : 'tidy');
    }, true);
  }

  // ---- first work interaction (every frame: Docs types into an iframe) ----
  let armed = null; // { eventId, handler }
  function disarm() {
    if (!armed) return;
    for (const t of ['keydown', 'mousedown', 'wheel']) window.removeEventListener(t, armed.handler, true);
    armed = null;
  }
  function armOnce(eventId) {
    disarm();
    const handler = (e) => {
      if (card && (card.contains(e.target) || (e.type === 'keydown' && CARD_KEYS.has(e.key)))) return; // card use is not work
      const id = armed && armed.eventId;
      disarm();
      send({ type: MSG.firstInteraction, eventId: id, at: Date.now() });
      log('first interaction', id);
    };
    armed = { eventId, handler };
    for (const t of ['keydown', 'mousedown', 'wheel']) window.addEventListener(t, handler, { capture: true, passive: true });
  }

  // ---- overlay stand-in: prompt() (top frame only) ----
  function openOverlay(askTaskName) {
    let taskName;
    if (askTaskName) {
      taskName = window.prompt('DEV STUB: task name?');
      if (taskName === null) return;
    }
    const nextStep = window.prompt('DEV STUB: your next step? (blank is fine)');
    if (nextStep === null) return;
    const msg = { type: MSG.parkNote, nextStep };
    if (askTaskName) msg.taskName = taskName;
    send(msg);
  }

  function restoreScroll(y) {
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const ed = docsEditor();
    (ed || window).scrollTo({ top: Number(y) || 0, behavior });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg && msg.type) {
      case MSG.snapshot:
        if (!TOP) return false; // let the top frame answer
        sendResponse({ url: location.href, scrollY: currentScroll(), highlight: currentHighlight() });
        return false;
      case MSG.armTimer: armOnce(msg.eventId); return false;
      case MSG.showCard: if (TOP) showCard(msg); return false;
      case MSG.restoreScroll: if (TOP) restoreScroll(msg.scrollY); return false;
      // prompt() blocks the page, so return from the listener first.
      case MSG.openOverlay: if (TOP) setTimeout(() => openOverlay(msg.askTaskName), 0); return false;
      default: return false;
    }
  });

  log('loaded', TOP ? 'top frame' : 'child frame', location.href.slice(0, 80));
})();
