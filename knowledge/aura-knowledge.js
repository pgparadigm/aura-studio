/* Aura Studio — structured local knowledge.
 *
 * Why this file exists, and what it is NOT.
 *
 * The source is a 1,269-line master document in two books: a craft layer (how to build, write and
 * sing a record) and a tools layer (what every AI music platform and FL Studio has, lacks, and
 * should have, verified 2026-07-31). Shipping that markdown as one enormous string would give Aura
 * a document to quote, not knowledge to act on. What is here instead is the subset that a guide
 * running on someone's own machine can either DO or honestly explain, cut into entries small enough
 * to route an intent to a real control.
 *
 * Architecture: ordinary <script> tags, one global namespace, no fetch, no build step, no JSON
 * loaded at runtime. That is not a stylistic choice — Aura has to work from `file://` after being
 * downloaded, and `fetch()` on a file:// URL fails in every browser. Anything that arrives by
 * XHR is a feature that breaks the moment the app leaves a web server.
 *
 * VOLATILITY. Book II is dated research, not fact. Every price, plan, model version, ownership
 * term, legal status and platform comparison in it was true on one day and will drift. Entries
 * carrying that kind of claim MUST set `verified` and `volatile`, and anything Aura says from them
 * has to show the date and advise re-verification before money or rights depend on it. Craft
 * knowledge — where a kick sits, how a tresillo counts — does not expire and does not carry a date.
 *
 * NAMES. Artist, producer and platform names live in the research and in source attribution. They
 * do not go into user-visible Aura copy, and no Aura sound, preset or vibe is named after anyone.
 */
(function (global) {
  'use strict';

  var K = global.AuraKnowledge = global.AuraKnowledge || {
    entries: [],
    domains: {},
    VERIFIED: '2026-07-31',
  };

  // Registering rather than assigning lets each domain file stand alone and load in any order.
  K.add = function (domain, list) {
    if (!Array.isArray(list)) return;
    K.domains[domain] = (K.domains[domain] || []).concat(list);
    list.forEach(function (e) {
      e.domain = domain;
      K.entries.push(e);
    });
  };

  // Match an entry by its trigger intents. Deliberately simple and deliberately strict: a guide
  // that half-matches is a guide that answers the wrong question confidently.
  K.match = function (text) {
    var t = String(text || '').toLowerCase();
    if (!t.trim()) return [];
    var hits = [];
    K.entries.forEach(function (e) {
      var score = 0;
      (e.triggers || []).forEach(function (re) {
        if (re.test(t)) score += 1;
      });
      if (score) hits.push({ entry: e, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.map(function (h) { return h.entry; });
  };

  K.byId = function (id) {
    for (var i = 0; i < K.entries.length; i++) if (K.entries[i].id === id) return K.entries[i];
    return null;
  };

  // A single place that formats the freshness caveat, so no caller can forget it.
  K.freshness = function (entry) {
    if (!entry || !entry.volatile) return '';
    return 'Researched ' + (entry.verified || K.VERIFIED) +
      '. Prices, plans, model versions and licence terms in this area change often — check the ' +
      'current terms yourself before money or rights depend on it.';
  };

  K.count = function () { return K.entries.length; };
})(window);
