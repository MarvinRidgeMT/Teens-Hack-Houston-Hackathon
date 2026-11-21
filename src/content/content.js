// Pickup — content script (Sid / Surface)
// Classic script, no imports. Load order in registerContentScripts:
//   src/vendor/motion.js, src/vendor/anime.umd.min.js, src/content/card.js, overlay.js, docs.js, content.js
// Runs in EVERY frame (allFrames: true). Only the top frame answers snapshot and draws UI;
// every frame watches for the first interaction, because Google Docs types into a hidden iframe.
//
// Contract: Anish's engine handoff, Thu Nov 19. Messages are FLAT: { type, ...fields }.

(function () {
  'use strict';
  if (window.__pickupContentLoaded) return; // guard against double injection
  window.__pickupContentLoaded = true;

  const MSG = {
    // service worker -> page
    snapshot: 'snapshot', showCard: 'showCard', armTimer: 'armTimer',
    restoreScroll: 'restoreScroll', openOverlay: 'openOverlay',
    startHere: 'startHere', // optional (Feature 2)
    // page -> service worker
    state: 'state', firstInteraction: 'firstInteraction',
    cardAction: 'cardAction', parkNote: 'parkNote',
  };

  const TOP = window === window.top;
  const UI = window.PickupUI || null; // from card.js + overlay.js (top frame draws)
  const DOCS = window.PickupDocs || null; // optional, from docs.js
  const DEBUG = false; // set true while testing to see [Pickup:content] logs in the page console
  const log = (...a) => { if (DEBUG) console.log('[Pickup:content]', TOP ? 'top' : 'frame', ...a); };

  const isDocs = location.hostname === 'docs.google.com';

  // ---------- where am I? ----------
  function scroller() {
    if (DOCS && DOCS.scroller) {
      const s = DOCS.scroller();
      if (s) return s;
    }
    if (isDocs) {
      const s = document.querySelector('.kix-appview-editor');
      if (s) return s;
    }
    return null; // null = the window scrolls
  }

  function currentScroll() {
    const s = scroller();
    return Math.round(s ? s.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0));
  }

  // Remember the last non-empty highlight: the selection disappears as soon as you click away.
  let lastHighlight = '';
  function currentHighlight() {
    let text = '';
    try {
      if (DOCS && DOCS.highlight) text = DOCS.highlight() || '';
      if (!text) text = String(window.getSelection ? window.getSelection() : '');
    } catch (_) { text = ''; }
    text = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (text) lastHighlight = text;
    return lastHighlight;
  }

  function snapshot() {
    return { url: location.href, scrollY: currentScroll(), highlight: currentHighlight() };
  }

  function send(msg) {
    try {
      chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); // swallow "no receiver"
    } catch (_) { /* extension reloaded; this page's script is orphaned */ }
  }

  // ---------- state: debounced, after 2 s without change ----------
  let stateTimer = null;
  let lastSent = '';
  function queueState() {
    if (!TOP) return;
    clearTimeout(stateTimer);
    stateTimer = setTimeout(() => {
      const s = snapshot();
      const key = `${s.url}|${s.scrollY}|${s.highlight}`;
      if (key === lastSent) return;
      lastSent = key;
      send({ type: MSG.state, ...s });
      log('state', s);
    }, 2000);
  }
  if (TOP) {
    window.addEventListener('scroll', queueState, { passive: true, capture: true }); // capture also catches the Docs container
    document.addEventListener('selectionchange', () => { currentHighlight(); queueState(); });
    window.addEventListener('pagehide', () => { // last chance before the tab closes
      const s = snapshot();
      send({ type: MSG.state, ...s });
    });
  }

  // ---------- restoreScroll ----------
  // Smooth only for short hops: a long smooth scroll is cancelled by the first wheel
  // or key press (which is also the first-interaction moment), so far jumps are instant.
  function restoreScroll(y) {
    const top = Math.max(0, Number(y) || 0);
    const s = scroller();
    const from = currentScroll();
    const viewH = s ? s.clientHeight : window.innerHeight;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduce || Math.abs(top - from) > viewH * 1.5 ? 'auto' : 'smooth';
    const go = () => (s ? s.scrollTo({ top, behavior }) : window.scrollTo({ top, behavior }));
    // Let the card's exit frame paint first, then scroll.
    requestAnimationFrame(go);
    log('restoreScroll', { to: top, from, behavior });
    if (DEBUG) setTimeout(() => log('restoreScroll landed at', currentScroll()), 1200);
  }

  // ---------- first interaction timer (all frames) ----------
  let armed = null; // { eventId, off }
  const ARM_EVENTS = ['keydown', 'mousedown', 'wheel'];

  function armOnce(eventId) {
    if (!eventId) return;
    if (armed) armed.off();
    const handler = (e) => {
      if (UI && UI.isOwnEvent && UI.isOwnEvent(e)) return; // card/overlay input is not work
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      if (e.type === 'keydown' && e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) return; // the Windows/Linux park key (park-task) is ours
      const id = armed && armed.eventId;
      if (armed) armed.off();
      armed = null;
      send({ type: MSG.firstInteraction, eventId: id, at: Date.now() });
      log('firstInteraction', id, e.type);
    };
    ARM_EVENTS.forEach((t) => window.addEventListener(t, handler, { capture: true, passive: true }));
    armed = {
      eventId,
      off: () => ARM_EVENTS.forEach((t) => window.removeEventListener(t, handler, { capture: true })),
    };
    log('armed', eventId);
  }

  // ---------- card + overlay (top frame only) ----------
  function showCard(msg) {
    if (!UI || !UI.showCard) { log('PickupUI missing: is card.js listed before content.js?'); return; }
    UI.showCard(msg, (action, eventId) => {
      send({ type: MSG.cardAction, eventId: eventId || msg.eventId, action });
      log('cardAction', action);
    });
  }

  function openOverlay(askTaskName) {
    if (!UI || !UI.openOverlay) { log('PickupUI.openOverlay missing: is overlay.js listed?'); return; }
    UI.openOverlay({
      askTaskName: !!askTaskName,
      onSave: ({ nextStep, taskName }) => {
        const out = { type: MSG.parkNote, nextStep: nextStep || '' };
        if (askTaskName && taskName) out.taskName = taskName;
        send(out);
        log('parkNote', out);
      },
    });
  }

  // ---------- message router ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return false;
    switch (msg.type) {
      case MSG.snapshot:
        if (!TOP) return false;                 // let the top frame answer
        { const s = snapshot(); log('snapshot', s); sendResponse(s); } // synchronous; also a ping
        return false;
      case MSG.armTimer:      armOnce(msg.eventId); return false;           // all frames
      case MSG.showCard:      if (TOP) showCard(msg); return false;
      case MSG.restoreScroll: if (TOP) restoreScroll(msg.scrollY); return false;
      case MSG.openOverlay:   if (TOP) openOverlay(msg.askTaskName); return false;
      case MSG.startHere:     if (TOP && UI && UI.showStartHere) UI.showStartHere(msg); return false;
    }
    return false;
  });

  log('ready', location.href);
})();
