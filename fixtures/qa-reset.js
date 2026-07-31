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
    // Falling back to a plain setTimeout is a trap, not a convenience: a hidden or backgrounded tab
    // throttles chained setTimeout to roughly one per minute after five minutes, so the fallback
    // does not run late — it appears to hang forever, with no error to find. Say so out loud.
    if (!sleep) console.warn('AuraQAReset.blankAndClear: no Worker-backed sleep passed. ' +
      'Falling back to setTimeout, which a hidden tab throttles to ~1/minute. Pass the suite\'s own sleep.');
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

  // Force the app frame to re-fetch its stylesheet.
  //
  // `index.html` links `styles.css?v=<APP_VERSION>`, and that URL does not change when the file is
  // edited — so a browser that has already fetched it during this session keeps serving the old
  // bytes even though the dev server sends `no-store`. A suite that measures CSS then measures a
  // stylesheet from an hour ago. That is not hypothetical: the Ask Aura button fix looked like it
  // had failed, and the rule was simply not in the frame's copy of the sheet.
  //
  // Call this AFTER the app has loaded, and await it — the swap is asynchronous.
  function freshStyles(frame) {
    var D = frame.contentDocument;
    if (!D) return Promise.resolve(false);
    var links = [].slice.call(D.querySelectorAll('link[rel="stylesheet"]'));
    if (!links.length) return Promise.resolve(false);
    return Promise.all(links.map(function (link) {
      return new Promise(function (res) {
        var href = link.getAttribute('href') || '';
        var bust = href.split('#')[0] + (href.indexOf('?') >= 0 ? '&' : '?') + 'qacache=' + Date.now();
        var fresh = D.createElement('link');
        fresh.rel = 'stylesheet';
        fresh.href = bust;
        fresh.onload = fresh.onerror = function () { if (link.parentNode) link.parentNode.removeChild(link); res(); };
        link.parentNode.insertBefore(fresh, link.nextSibling);
      });
    })).then(function () { return true; });
  }

  global.AuraQAReset = { blankAndClear: blankAndClear, freshStyles: freshStyles, PROJECT_KEYS: PROJECT_KEYS };
})(window);
