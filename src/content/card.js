// Pickup — return card (Sid / Surface) · v3
// Classic content script, no build step. Load order in registerContentScripts:
//   src/vendor/motion.js, src/vendor/anime.umd.min.js, src/content/card.js, overlay.js, docs.js, content.js
//
// Built with what the reference libraries give us:
//   Motion (motion.dev)   -> spring entrance, stagger, press/hover gestures (keyboard-aware)
//   Anime.js (animejs.com)-> splitText word reveal on the headline, number roll for "away N min"
//   Kokonut UI patterns   -> hairline dark card + kbd chips, Metric Card rolling number
// Falls back to plain CSS if a library file is missing.
//
// window.PickupUI:
//   showCard(data, onAction)  data = showCard message; onAction('resume'|'notNow'|'tidy', eventId)
//   hideCard()
//   isOwnEvent(e)             true if the event came from Pickup UI (never counts as work interaction)
//   shared for overlay.js: mount, unmount, el, TOKENS, M, A, reduceMotion, pressable
//
// Every line on the card is a recorded fact or the user's own words.

(function () {
  'use strict';
  if (window.PickupUI) return; // already injected

  const M = window.Motion || null; // { animate, stagger, press, hover, spring }
  const A = window.anime || null;  // { animate, splitText, stagger, createTimeline }

  const TOKENS = `
    :host {
      all: initial;
      --pk-bg: #15142b;
      --pk-panel: rgba(165, 140, 255, .10);
      --pk-line: rgba(241, 239, 252, .12);
      --pk-line-strong: rgba(241, 239, 252, .24);
      --pk-ink: #f4f2ff;
      --pk-muted: #b9b4da;
      --pk-faint: #9893c4;
      --pk-accent: #c9ff38;
      --pk-accent-hi: #dbff75;
      --pk-accent-ink: #121126;
      --pk-accent-glow: rgba(201, 255, 56, .30);
      --pk-radius: 20px;
      --pk-font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --pk-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      --pk-ease-out: cubic-bezier(.23, 1, .32, 1);
    }
  `;

  const reduceMotion = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canAnimate = () => !reduceMotion();

  const hosts = new Set();

  function mount(id) {
    let host = document.getElementById(id);
    if (host) { hosts.delete(host); host.remove(); }
    host = document.createElement('pickup-ui');
    host.id = id;
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; display: block;';
    const root = host.attachShadow({ mode: 'open' });
    ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'click', 'wheel']
      .forEach((t) => host.addEventListener(t, (e) => e.stopPropagation()));
    (document.body || document.documentElement).appendChild(host);
    hosts.add(host);
    return { host, root };
  }

  function unmount(host) {
    if (!host) return;
    hosts.delete(host);
    host.remove();
  }

  function isOwnEvent(e) {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
    for (const h of hosts) if (path.includes(h)) return true;
    return false;
  }

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    }
    for (const kid of kids) if (kid) n.append(kid);
    return n;
  }

  // Motion press gesture: springy scale-down, works for pointer and keyboard (Enter/Space).
  function pressable(node, scale = 0.96) {
    if (!M || !M.press || !canAnimate()) return;
    M.press(node, (target) => {
      M.animate(target, { scale }, { 'type': 'spring', stiffness: 700, damping: 30 });
      return () => M.animate(target, { scale: 1 }, { 'type': 'spring', stiffness: 500, damping: 18 });
    });
  }

  function awayParts(ms) {
    const min = Math.round((ms || 0) / 60000);
    if (min < 1) return { n: null, text: 'under 1 min' };
    if (min < 60) return { n: min, text: `${min} min` };
    const h = Math.floor(min / 60), m = min % 60;
    return { n: null, text: m ? `${h} h ${m} min` : `${h} h` };
  }

  // Where the next step came from (engine: nextStepSource). Always the user's own words.
  function sourceLabel(src) {
    if (src === 'selected') return 'you picked this';
    if (src === 'spoken') return 'you said this';
    return 'you wrote this';
  }

  function clip(text, max) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, '') + '…';
  }

  const ARROW_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const CARD_CSS = `
    ${TOKENS}
    .wrap {
      position: fixed; top: 20px; right: 20px;
      width: min(440px, calc(100vw - 40px));
      font-family: var(--pk-font); color: var(--pk-ink);
      font-size: 16px; line-height: 1.45; -webkit-font-smoothing: antialiased;
    }
    .card {
      position: relative; background: var(--pk-bg); border-radius: var(--pk-radius);
      box-shadow: 0 0 0 1px var(--pk-line) inset, 0 1px 0 0 rgba(255,255,255,.06) inset,
        0 30px 60px -20px rgba(0,0,0,.55), 0 10px 24px -8px rgba(0,0,0,.35);
      padding: 18px 20px 16px; transform-origin: top right; overflow: hidden;
    }
    /* The facts line sits under the heading (no kicker above it), in the text face. */
    .meta { position: relative; display: flex; align-items: center; gap: 8px; margin-top: 6px;
      font-size: 13px; color: var(--pk-muted); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--pk-accent); }
    @media (prefers-reduced-motion: no-preference) {
      .dot { animation: pk-pulse 2.4s var(--pk-ease-out) infinite; }
      @keyframes pk-pulse { 0% { box-shadow: 0 0 0 0 var(--pk-accent-glow); } 70%, 100% { box-shadow: 0 0 0 8px rgba(201,255,56,0); } }
    }
    .sep { color: var(--pk-faint); }
    .away { color: var(--pk-ink); font-variant-numeric: tabular-nums; }
    h2 { position: relative; margin: 2px 0 0; font-size: 22px; line-height: 1.25; font-weight: 600;
      letter-spacing: -.02em; overflow-wrap: anywhere; }
    h2 .thread { color: var(--pk-accent-ink); background: linear-gradient(var(--pk-accent), var(--pk-accent)) no-repeat 0 62% / 100% 88%;
      padding: 0 .12em; margin: 0 -.04em; border-radius: .14em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    .next { position: relative; margin-top: 14px; padding: 12px 14px; background: var(--pk-panel);
      border-radius: 14px; box-shadow: 0 0 0 1px var(--pk-line) inset; }
    .label { margin: 0 0 4px; font-size: 12.5px; color: var(--pk-muted); }
    .label b { color: #cfc4ff; font-weight: 600; }
    .next p.text { margin: 0; font-size: 17px; line-height: 1.4; overflow-wrap: anywhere; }
    .facts { position: relative; margin: 14px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; }
    .facts dt { font-size: 13px; font-weight: 500; color: var(--pk-faint); padding-top: 1px; }
    .facts dd { margin: 0; font-size: 15px; overflow-wrap: anywhere; }
    .q { color: var(--pk-muted); font-style: italic; }
    .soft { color: var(--pk-muted); }
    .actions { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 18px; }
    button {
      font: inherit; font-size: 15px; font-weight: 500; letter-spacing: -.01em;
      border: 0; border-radius: 999px; padding: 10px 16px; cursor: pointer;
      color: var(--pk-ink); background: rgba(255,255,255,.06); box-shadow: 0 0 0 1px var(--pk-line) inset;
      display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap;
      transition: background-color .15s var(--pk-ease-out), box-shadow .15s var(--pk-ease-out);
    }
    button:hover { background: rgba(255,255,255,.1); box-shadow: 0 0 0 1px var(--pk-line-strong) inset; }
    button.primary { grid-column: 1 / -1; padding: 12px 16px; font-size: 16px; font-weight: 600;
      background: var(--pk-accent); color: var(--pk-accent-ink);
      box-shadow: 0 0 0 1px rgba(255,255,255,.25) inset, 0 6px 14px -6px rgba(0,0,0,.45); }
    button.primary:hover { background: var(--pk-accent-hi); }
    button .arrow { display: inline-grid; }
    button:focus-visible { outline: 2px solid var(--pk-accent); outline-offset: 3px; }
    kbd { font-family: var(--pk-mono); font-size: 11px; font-weight: 500; line-height: 1; padding: 3px 5px; border-radius: 5px;
      background: rgba(255,255,255,.08); box-shadow: 0 0 0 1px var(--pk-line) inset; color: var(--pk-muted); }
    button.primary kbd { background: rgba(18,17,38,.12); box-shadow: 0 0 0 1px rgba(18,17,38,.24) inset; color: var(--pk-accent-ink); }
    .card:focus { outline: none; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `;

  let current = null; // { host, card }

  function hideCard(animated) {
    if (!current) return;
    const { host, card } = current;
    current = null;
    if (animated && canAnimate() && M) {
      M.animate(card, { opacity: 0, y: -8, scale: 0.97 }, { duration: 0.16, ease: [0.4, 0, 1, 1] })
        .then(() => unmount(host), () => unmount(host));
    } else {
      unmount(host);
    }
  }

  // data: { eventId, threadName, awayMs, nextStep?, where: { scrollY, highlight }, tabCount }
  function showCard(data, onAction) {
    hideCard(false);
    const { host, root } = mount('pickup-card');
    const style = el('style');
    style.textContent = CARD_CSS;

    const thread = data.threadName || 'your task';
    const nextStep = data.nextStep && String(data.nextStep).trim();
    const highlight = data.where && data.where.highlight && String(data.where.highlight).trim();
    const tabs = Number(data.tabCount) || 0;
    const away = awayParts(data.awayMs);

    const awayEl = el('span', { class: 'away', text: `away ${away.text}` });

    const facts = el('dl', { class: 'facts' });
    if (highlight) facts.append(el('dt', { text: 'Highlight' }),
      el('dd', null, el('span', { class: 'q', text: `“${clip(highlight, 140)}”` })));
    facts.append(el('dt', { text: 'Spot' }), el('dd', { text: 'Scroll position saved' }));
    if (tabs > 0) facts.append(el('dt', { text: 'Thread' }),
      el('dd', null, `${tabs} ${tabs === 1 ? 'tab' : 'tabs'} `, el('span', { class: 'soft', text: '· suggested, edit anytime' })));

    const arrow = el('span', { class: 'arrow' });
    arrow.innerHTML = ARROW_SVG;
    const btnResume = el('button', { class: 'primary', 'type': 'button', 'data-action': 'resume' },
      'Resume', arrow, el('kbd', { 'aria-hidden': 'true', text: '↵' }));
    const btnTidy = el('button', { 'type': 'button', 'data-action': 'tidy' },
      'Tidy distraction tabs?', el('kbd', { 'aria-hidden': 'true', text: 'T' }));
    const btnNot = el('button', { 'type': 'button', 'data-action': 'notNow' },
      'Not now', el('kbd', { 'aria-hidden': 'true', text: 'Esc' }));
    const buttons = [btnResume, btnTidy, btnNot];

    const title = el('h2', { id: 'pk-card-title' }, el('span', { class: 'lead', text: 'Welcome back to ' }),
      el('span', { class: 'thread', text: thread }));

    const rows = [
      title,
      el('div', { class: 'meta' }, el('span', { class: 'dot', 'aria-hidden': 'true' }),
        el('span', { text: 'Pickup' }), el('span', { class: 'sep', text: '·' }), awayEl),
      nextStep && el('div', { class: 'next' },
        el('p', { class: 'label' }, el('b', { text: 'Your next step' }), ` · ${sourceLabel(data.nextStepSource)}`),
        el('p', { class: 'text', text: nextStep })),
      facts,
      el('div', { class: 'actions' }, ...buttons),
    ].filter(Boolean);

    const card = el('div', { class: 'card', role: 'dialog', tabindex: '-1', 'aria-labelledby': 'pk-card-title', 'aria-describedby': 'pk-card-keys' },
      ...rows,
      el('p', { class: 'sr', id: 'pk-card-keys',
        text: `Away ${away.text}. Press Enter to resume, T to tidy distraction tabs, Escape for not now.` }));

    root.append(style, el('div', { class: 'wrap' }, card));

    // ---------------- motion ----------------
    if (canAnimate()) {
      if (M) {
        // Motion: spring the card in, then stagger every row
        M.animate(card, { opacity: [0, 1], y: [-16, 0], scale: [0.96, 1] },
          { 'type': 'spring', stiffness: 340, damping: 26 });
        M.animate(rows.filter((r) => r !== title), { opacity: [0, 1], y: [8, 0] },
          { 'type': 'spring', stiffness: 260, damping: 24, delay: M.stagger(0.05, { startDelay: 0.08 }) });
        // Motion hover: nudge the Resume arrow
        if (M.hover) M.hover(btnResume, () => {
          M.animate(arrow, { x: 3 }, { 'type': 'spring', stiffness: 500, damping: 20 });
          return () => M.animate(arrow, { x: 0 }, { 'type': 'spring', stiffness: 500, damping: 20 });
        });
      }
      if (A && A.splitText) {
        // Anime.js: headline words rise out of a clip mask, one after another
        try {
          const split = A.splitText(title, { words: { wrap: 'clip' } });
          A.animate(split.words, { y: ['110%', '0%'], duration: 650, delay: A.stagger(45, { start: 120 }), ease: 'out(4)' });
        } catch (_) { /* keep static headline */ }
      }
      if (A && away.n && away.n > 1) {
        // Anime.js number roll (Kokonut Metric Card style)
        const counter = { n: 0 };
        A.animate(counter, { n: away.n, duration: 700, delay: 150, ease: 'out(3)', modifier: Math.round,
          onUpdate: () => { awayEl.textContent = `away ${Math.max(1, counter.n)} min`; } });
      }
    }
    buttons.forEach((b) => pressable(b));

    let done = false;
    function act(action) {
      if (done) return;
      done = true;
      hideCard(true);
      if (typeof onAction === 'function') onAction(action, data.eventId);
    }

    buttons.forEach((b) => b.addEventListener('click', () => act(b.dataset.action)));

    root.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Escape') { e.preventDefault(); act('notNow'); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); act('tidy'); }
      else if (e.key === 'Tab') {
        const i = buttons.indexOf(root.activeElement);
        e.preventDefault();
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      }
    });

    current = { host, card };
    requestAnimationFrame(() => btnResume.focus({ preventScroll: true }));
  }

  // ---------- Start here (optional engine message, Feature 2) ----------
  // { threadName, nextStep?, nextStepSource?, wrappedAt }. One line + Resume. Facts only.
  function showStartHere(data, onClose) {
    hideCard(false);
    const { host, root } = mount('pickup-card');
    const style = el('style');
    style.textContent = CARD_CSS;
    const thread = data.threadName || 'your task';
    const nextStep = data.nextStep && String(data.nextStep).trim();
    let at = '';
    try { if (data.wrappedAt) at = new Date(data.wrappedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (_) {}

    const arrow = el('span', { class: 'arrow' });
    arrow.innerHTML = ARROW_SVG;
    const btnResume = el('button', { class: 'primary', 'type': 'button' }, 'Resume', arrow, el('kbd', { 'aria-hidden': 'true', text: '↵' }));
    const btnClose = el('button', { 'type': 'button' }, 'Close', el('kbd', { 'aria-hidden': 'true', text: 'Esc' }));
    const title = el('h2', { id: 'pk-card-title' }, el('span', { class: 'lead', text: 'Start here: ' }), el('span', { class: 'thread', text: thread }));
    const rows = [
      title,
      el('div', { class: 'meta' }, el('span', { class: 'dot', 'aria-hidden': 'true' }), el('span', { text: 'Pickup' }),
        el('span', { class: 'sep', text: '·' }), el('span', { class: 'away', text: at ? `stopped at ${at}` : 'from last time' })),
      nextStep && el('div', { class: 'next' },
        el('p', { class: 'label' }, el('b', { text: 'Your next step' }), ` · ${sourceLabel(data.nextStepSource)}`),
        el('p', { class: 'text', text: nextStep })),
      el('div', { class: 'actions' }, btnResume, btnClose),
    ].filter(Boolean);
    const card = el('div', { class: 'card', role: 'dialog', tabindex: '-1', 'aria-labelledby': 'pk-card-title' }, ...rows);
    root.append(style, el('div', { class: 'wrap' }, card));
    if (canAnimate() && M) {
      M.animate(card, { opacity: [0, 1], y: [-16, 0], scale: [0.96, 1] }, { 'type': 'spring', stiffness: 340, damping: 26 });
      M.animate(rows, { opacity: [0, 1], y: [8, 0] }, { 'type': 'spring', stiffness: 260, damping: 24, delay: M.stagger(0.05, { startDelay: 0.08 }) });
    }
    [btnResume, btnClose].forEach((b) => pressable(b));
    let done = false;
    const close = (how) => { if (done) return; done = true; hideCard(true); if (typeof onClose === 'function') onClose(how); };
    btnResume.addEventListener('click', () => close('resume'));
    btnClose.addEventListener('click', () => close('close'));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close('close'); }
      else if (e.key === 'Tab') { e.preventDefault(); (root.activeElement === btnResume ? btnClose : btnResume).focus(); }
    });
    current = { host, card };
    requestAnimationFrame(() => btnResume.focus({ preventScroll: true }));
  }

  window.PickupUI = { showCard, showStartHere, hideCard, isOwnEvent, mount, unmount, el, TOKENS, M, A, reduceMotion, pressable };
})();
