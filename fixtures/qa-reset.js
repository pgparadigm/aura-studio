/* Aura Studio QA — put the browser profile into a known-empty state before a suite boots the app.
 *
 * Reloading the iframe is not enough. The app restores its autosave at boot, so a suite that only
 * swaps the iframe src inherits whatever project the previous suite left in this browser profile.
 * That is invisible until it isn't: `apply-safety.html` reported "Fill: no previously set step was
 * cleared" purely because `a11y-qa.html` had run first and left behind a project carrying a
 * variation, and it passed 21/21 the moment it ran alone. A baseline that depends on run order is
 * not a baseline.
 *
 * Call `await AuraQAReset.blankAndClear(frame, sleep)` immediately BEFORE the suite's own
 * `frame.src = '../index.html?tag=' + Date.now()` line. Both steps are load-bearing and the order
 * is the point: a live instance keeps autosaving on a timer and will rewrite the key underneath the
 * clear, so the frame must be parked on about:blank first.
 *
 * `aura-midi-maps` is cleared too. Controller mappings live in localStorage by design — never in
 * `.aura` — so they survive a project reset and would otherwise leak between suites.
 *
 * Pass the suite's own Worker-backed `sleep`. A hidden tab throttles chained setTimeout to roughly
 * one per minute after five minutes, which would make this settle land at an unpredictable point
 * rather than merely late.
 */
(function (global) {
  'use strict';

  var PROJECT_KEYS = ['aura-studio-v6', 'aura-recent', 'aura-midi-maps'];

  function blankAndClear(frame, sleep, opts) {
    opts = opts || {};
    var wait = sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    return new Promise(function (res) { frame.onload = res; frame.src = 'about:blank'; })
      .then(function () { return wait(150); })
      .then(function () {
        try {
          PROJECT_KEYS.forEach(function (k) { localStorage.removeItem(k); });
          // Suppress the welcome overlay unless a suite is specifically testing first-run.
          if (!opts.keepWelcome) localStorage.setItem('aura-seen', '1');
        } catch (e) { /* storage disabled: already isolated */ }
      });
  }

  global.AuraQAReset = { blankAndClear: blankAndClear, PROJECT_KEYS: PROJECT_KEYS };
})(window);
