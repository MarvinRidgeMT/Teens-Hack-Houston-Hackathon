// Pickup — Google Docs helpers (Sid / Surface)
// Classic content script, loaded before content.js. Only does anything on docs.google.com.
// Fill in after the Docs spike: content.js already falls back to .kix-appview-editor
// and window.getSelection(), so this file can stay as-is if those work.

(function () {
  'use strict';
  if (window.PickupDocs) return;
  if (location.hostname !== 'docs.google.com') { window.PickupDocs = null; return; }

  window.PickupDocs = {
    // The element that actually scrolls in the Docs editor (not the window).
    scroller() {
      return document.querySelector('.kix-appview-editor') || null;
    },
    // Docs draws text on a canvas, so getSelection() is usually empty there.
    // Return '' rather than guessing; the card then shows no highlight line.
    highlight() {
      try { return String(window.getSelection()).trim(); } catch (_) { return ''; }
    },
  };
})();
