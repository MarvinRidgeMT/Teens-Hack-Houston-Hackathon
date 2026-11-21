// Pickup — Alt+P "park" overlay (Sid / Surface) · v3 (V4 visuals: pearl bar, plum text, green save)
// Classic content script. Needs card.js loaded first (uses PickupUI helpers).
//
// Built from what the reference libraries give us:
//   Manus            -> calm command bar with a round send button
//   Motion           -> spring in/out, press gesture on the send button
//   Kokonut UI       -> Save Status / Status Island: after saving, the bar collapses into a
//                       "Parked ✓" pill with a drawn check (Hold Button's check), then leaves
//
// PickupUI.openOverlay({ askTaskName, onSave, onClose })
//   askTaskName: true on first use in a tab -> asks the task name, then the next step
//   onSave({ nextStep, taskName? })  -> content.js sends parkNote
//   onClose()                          -> Esc, nothing saved
// PickupUI.closeOverlay()

(function () {
  'use strict';
  const UI = window.PickupUI;
  if (!UI || UI.openOverlay) return;
  const { el, mount, unmount, TOKENS, M, A, reduceMotion, pressable } = UI;
  const canAnimate = () => !reduceMotion();

  const CSS = `
    ${TOKENS}
    .wrap { position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
      width: min(600px, calc(100vw - 32px)); display: flex; justify-content: center;
      font-family: var(--pk-font); color: var(--pk-ink); font-size: 16px; -webkit-font-smoothing: antialiased; }
    .bar { width: 100%; box-sizing: border-box; background: var(--pk-bg); border-radius: 20px;
      -webkit-backdrop-filter: blur(16px) saturate(140%); backdrop-filter: blur(16px) saturate(140%);
      box-shadow: var(--pk-shadow);
      padding: 12px 12px 10px 16px; transition: box-shadow .2s var(--pk-ease-out); }
    /* Focus: a clear accent ring on the whole bar (the input itself has no outline). */
    .bar:focus-within { box-shadow: 0 0 0 2px var(--pk-focus) inset, 0 0 0 5px var(--pk-focus-glow), 0 30px 60px -24px rgba(76, 52, 140, .42); }
    /* Invalid (empty task name): a danger ring, plus the placeholder stays; never colour alone (the bar also shakes, and Enter does nothing). */
    .bar:has(input[aria-invalid="true"]) { box-shadow: 0 0 0 2px var(--pk-danger) inset, 0 30px 60px -24px rgba(76, 52, 140, .42); }
    /* The input's label, in the text face (no mono caps). */
    .top { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--pk-muted); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--pk-dot); }
    .step { margin-left: auto; color: var(--pk-faint); font-variant-numeric: tabular-nums; }
    .row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
    input { flex: 1; min-width: 0; box-sizing: border-box; font: inherit; font-size: 18px; letter-spacing: -.01em;
      color: var(--pk-ink); background: transparent; border: 0; padding: 6px 0; outline: none; caret-color: var(--pk-link); }
    input::placeholder { color: var(--pk-faint); }
    .go { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center;
      background: var(--pk-accent); color: var(--pk-accent-ink); box-shadow: 0 0 0 1px var(--pk-accent-edge) inset;
      transition: opacity .15s var(--pk-ease-out), background-color .15s var(--pk-ease-out); }
    .go:hover:not([disabled]) { background: var(--pk-accent-hi); }
    .go[disabled] { opacity: .4; cursor: default; box-shadow: 0 0 0 1px var(--pk-line-strong) inset; }
    .go:focus-visible { outline: 2px solid var(--pk-focus); outline-offset: 3px; }
    .hint { margin: 8px 0 0; display: flex; gap: 12px; font-size: 13px; color: var(--pk-muted); }
    kbd { font-family: var(--pk-mono); font-size: 11px; padding: 2px 5px; border-radius: 6px; margin-right: 4px;
      background: var(--pk-key-bg); box-shadow: 0 0 0 1px var(--pk-line-strong) inset; color: var(--pk-muted); }

    /* Save Status / Status Island pill */
    .pill { display: inline-flex; align-items: center; gap: 10px; padding: 9px 16px 9px 10px; border-radius: 999px;
      background: var(--pk-bg); box-shadow: var(--pk-shadow);
      font-size: 14px; white-space: nowrap; max-width: 100%; }
    .check { width: 22px; height: 22px; border-radius: 50%; background: var(--pk-accent); box-shadow: 0 0 0 1px var(--pk-accent-edge) inset; display: grid; place-items: center; flex: none; }
    .check path { stroke: var(--pk-accent-ink); }
    .pill .what { font-weight: 650; color: var(--pk-link); }
    .pill .name { overflow: hidden; text-overflow: ellipsis; color: var(--pk-ink); }
  `;

  const ARROW_UP = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6 9.6 3.6" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0"/></svg>';

  let current = null;

  function closeOverlay() {
    if (!current) return;
    const { host, bar } = current;
    current = null;
    if (canAnimate() && M) {
      M.animate(bar, { opacity: 0, y: -8, scale: 0.97 }, { duration: 0.14, ease: [0.4, 0, 1, 1] })
        .then(() => unmount(host), () => unmount(host));
    } else unmount(host);
  }

  // Kokonut "Save Status" moment: bar -> pill with a drawn check, then gone.
  function showParked(host, root, wrap, bar, label) {
    const check = el('span', { class: 'check' });
    check.innerHTML = CHECK;
    const pill = el('div', { class: 'pill', role: 'status' },
      check, el('span', { class: 'what', text: 'Parked' }), el('span', { class: 'name', text: label }));
    const finish = () => {
      setTimeout(() => {
        if (!host.isConnected) return;
        if (canAnimate() && M) {
          M.animate(pill, { opacity: 0, y: -10, scale: 0.94 }, { duration: 0.2, ease: [0.4, 0, 1, 1] })
            .then(() => unmount(host), () => unmount(host));
        } else unmount(host);
      }, 1600);
    };
    if (!canAnimate() || !M) { bar.replaceWith(pill); finish(); return; }
    M.animate(bar, { opacity: 0, scale: 0.92 }, { duration: 0.12 }).then(() => {
      bar.replaceWith(pill);
      M.animate(pill, { opacity: [0, 1], scale: [0.85, 1], y: [-6, 0] }, { 'type': 'spring', stiffness: 520, damping: 26 });
      const path = check.querySelector('path');
      if (A) A.animate(path, { strokeDashoffset: [1, 0], duration: 380, delay: 120, ease: 'out(3)' });
      finish();
    });
  }

  function openOverlay(opts) {
    const { askTaskName = false, onSave, onClose, taskLabel } = opts || {};
    if (current) { unmount(current.host); current = null; }
    const { host, root } = mount('pickup-overlay');
    const style = el('style');
    style.textContent = CSS;

    const labelText = el('span', { id: 'pk-label' });
    const stepText = el('span', { class: 'step' });
    const input = el('input', { id: 'pk-input', 'type': 'text', maxlength: '140', autocomplete: 'off',
      'aria-labelledby': 'pk-label', 'aria-describedby': 'pk-hint' });
    const go = el('button', { class: 'go', 'type': 'button', 'aria-label': 'Save' });
    go.innerHTML = ARROW_UP;
    const hint = el('p', { class: 'hint', id: 'pk-hint' });

    const bar = el('div', { class: 'bar', role: 'dialog', 'aria-labelledby': 'pk-label' },
      el('div', { class: 'top' }, el('span', { class: 'dot', 'aria-hidden': 'true' }), labelText, stepText),
      el('div', { class: 'row' }, input, go), hint);
    const wrap = el('div', { class: 'wrap' }, bar);
    root.append(style, wrap);
    pressable(go, 0.9);

    let stage = askTaskName ? 'task' : 'next';
    let taskName = '';

    function setHint(word) {
      hint.textContent = '';
      hint.append(el('span', null, el('kbd', { text: '↵' }), word), el('span', null, el('kbd', { text: 'Esc' }), 'cancel'));
    }
    function sync() { go.disabled = stage === 'task' && !input.value.trim(); }
    function render() {
      input.value = '';
      if (stage === 'task') {
        labelText.textContent = 'Pickup · name this task';
        stepText.textContent = '1 / 2';
        input.placeholder = 'Climate Essay';
        setHint('continue');
      } else {
        labelText.textContent = 'Pickup · your next step';
        stepText.textContent = askTaskName ? '2 / 2' : 'optional';
        input.placeholder = 'Find a source for the drought statistic';
        setHint('park it');
        if (askTaskName && canAnimate() && M) M.animate(input, { opacity: [0, 1], x: [10, 0] }, { 'type': 'spring', stiffness: 400, damping: 30 });
      }
      sync();
      input.focus({ preventScroll: true });
    }

    function submit() {
      const v = input.value.trim();
      if (stage === 'task') {
        if (!v) {
          input.setAttribute('aria-invalid', 'true');
          if (canAnimate() && M) M.animate(bar, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.32 });
          return;
        }
        taskName = v;
        stage = 'next';
        input.removeAttribute('aria-invalid');
        render();
        return;
      }
      const out = { nextStep: v };
      if (askTaskName) out.taskName = taskName;
      current = null; // the pill now owns the host
      if (typeof onSave === 'function') onSave(out);
      showParked(host, root, wrap, bar, taskName || taskLabel || (v ? 'next step saved' : 'spot saved'));
    }

    input.addEventListener('input', sync);
    go.addEventListener('click', submit);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay();
        if (typeof onClose === 'function') onClose();
      } else if (e.key === 'Enter' && !e.isComposing && e.target === input) {
        e.preventDefault();
        submit();
      }
    });

    if (canAnimate() && M) {
      M.animate(bar, { opacity: [0, 1], y: [-12, 0], scale: [0.97, 1] }, { 'type': 'spring', stiffness: 380, damping: 28 });
    }

    current = { host, bar };
    requestAnimationFrame(render);
  }

  UI.openOverlay = openOverlay;
  UI.closeOverlay = closeOverlay;
})();
