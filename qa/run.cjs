#!/usr/bin/env node
// Aura dashboard QA runner. TEST-ONLY: the app never loads this file.
//
// Drives the qa/dashboard-*.qa.js checks in real browsers (Playwright's Chromium and WebKit), each
// job in a FRESH browser context (so storage is empty, as every suite expects), at the viewport the
// job names. The checks themselves run inside the page, against the shipped /rc/ build.
//
//   node qa/run.cjs [--engines chromium,webkit] [--jobs a,b,c,d,e,gate] [--only <job id substring>]
//                   [--base <url>] [--out <file.json>]
//
// --base defaults to a static server this script starts on 127.0.0.1 over the repository root, so
// /rc/ and /qa/ are served side by side. Pass the live site's root to check the published build.
//
// Playwright is not a project dependency (Aura has no build and no node_modules). It is installed
// once, outside iCloud, at ~/.local/share/aura-qa (override with AURA_QA_PW). See docs/QA-RUNNER.md.
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const PW = process.env.AURA_QA_PW || path.join(process.env.HOME, '.local/share/aura-qa/node_modules/playwright-core');
const { chromium, webkit } = require(PW);

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ENGINES = arg('engines', 'chromium,webkit').split(',');
const WANT = arg('jobs', 'a,b,c,d,e,gate').split(',');
const ONLY = arg('only', '');
const OUT = arg('out', '');
// --snapshot serves a frozen copy of rc/ and qa/ taken at start, so a long run tests ONE build even
// while the working tree is being edited (without it, files are served live from disk).
let ROOT = path.resolve(__dirname, '..');
if (argv.includes('--snapshot')) {
  const snapDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'aura-qa-snap-'));
  for (const d of ['rc', 'qa']) fs.cpSync(path.join(ROOT, d), path.join(snapDir, d), { recursive: true });
  ROOT = snapDir; console.log('serving a snapshot of rc/ and qa/ from ' + snapDir);
}
// The build to compare against for `base: true` jobs: a directory holding an older `rc/` (for example
// `git archive f304607 rc | tar -x -C <dir>`). /qa/ is always served from this checkout.
const BASE_ROOT = arg('base-root', '');

const V = { phone: [375, 812], w1024: [1024, 768], w1280: [1280, 800], w1440: [1440, 900] };
// One job = one fresh context. `steps` run in order; `{reload:true}` reloads the page keeping storage.
// `rows:true` means the check returns an array of {id, claim, pass, ev} rows (A's claims tables).
// `audio:true` means the check needs a running AudioContext clock (see clockProbe).
const J = [];
const job = (suite, id, o) => J.push(Object.assign({ suite, id, vp: V.w1440, steps: [{ fn: id }] }, o || {}));
// ---- the ship gate: fresh layout at four widths, and the live shrink ----
for (const [n, vp] of Object.entries(V)) job('gate', 'layout@' + n, { file: 'a', vp, steps: [{ fn: 'layout' }] });
job('gate', 'shrink1440to375', { file: 'a', vp: V.w1440, steps: [{ shrinkTo: V.phone }] });
// ---- A ----
job('a', 'a1@1024', { vp: V.w1024, steps: [{ fn: 'a1' }] });
job('a', 'a1@1280', { vp: V.w1280, steps: [{ fn: 'a1' }] });
job('a', 'a2NoTouch', { vp: V.w1280 });
job('a', 'a2Draw+reload+a2Expect', { vp: V.w1280, steps: [{ fn: 'a2Draw' }, { reload: true }, { fn: 'a2Expect' }] });
// a2File restores a curve the page already has, so it follows a2Draw (plan A, step 8).
job('a', 'a2Draw+a2File', { vp: V.w1280, steps: [{ fn: 'a2Draw' }, { fn: 'a2File' }] });
job('a', 'a3ApplyUndo'); job('a', 'a3OtherEdit'); job('a', 'a3DrawUndo'); job('a', 'a3PreviewNoLeak');
job('a', 'claimsA', { rows: true }); job('a', 'claimsB', { rows: true, audio: true }); job('a', 'claimsC', { rows: true });
// ---- B ----
['b1Drag', 'b1NoOp', 'b1Cancel', 'b1Resize', 'b2Grid', 'b3Lanes', 'b4Select'].forEach(f => job('b', f));
// These three need neighbouring sections: the demo arrangement first, on the same fresh load (plan B).
const demo = { fn: 'loadDemoArrangement', setup: true };
job('b', 'demo+b1Blocked', { steps: [demo, { fn: 'b1Blocked' }] });
for (const [n, vp] of [['1024', V.w1024], ['1280', V.w1280], ['1440', V.w1440]]) job('b', 'demo+b2Grid@' + n, { vp, steps: [demo, { fn: 'b2Grid' }] });
job('b', 'demo+b2Loop', { audio: true, steps: [demo, { fn: 'b2Loop' }] });
// ---- C ----
['c1Target', 'c1NotLouder', 'c1OnlySection', 'c1Backbone', 'c1DeterministicUndo', 'c1PreviewNoLeak', 'c1ReportTrue', 'c2WholeSong'].forEach(f => job('c', f));
// ---- D ----
['d1SplitNeverErases', 'd1SplitExact', 'd1RepeatNoLoss', 'd1OwnRemove', 'd4TargetFollows', 'd2Editors', 'd3Voice', 'd3Atmosphere', 'd0Guidance'].forEach(f => job('d', f));
// ---- E (the mixer) is appended by qa/dashboard-e.jobs.cjs when it exists ----
const eJobs = path.join(__dirname, 'dashboard-e.jobs.cjs');
if (fs.existsSync(eJobs)) require(eJobs)(job, V);

// A static server over the repository root, bound to loopback only. No caching, so a rebuilt file
// is never shadowed by an old copy.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav' };
function serve(rcRoot) {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const root = (rcRoot && p.startsWith('/rc/')) ? rcRoot : ROOT;
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

// A harmless point to click, so the page has a real (trusted) user gesture before any check runs:
// WebKit will not start an AudioContext without one. The point must not land on a control.
async function trustedGesture(page) {
  const pt = await page.evaluate(() => {
    const bad = el => !!(el && el.closest('button,input,select,textarea,a,label,canvas,[role=button],[role=slider],[tabindex],.sa-clip,.sa-lane,.strip'));
    for (let y = 8; y < innerHeight; y += 23) for (let x = innerWidth - 6; x > 0; x -= 37) {
      const el = document.elementFromPoint(x, y); if (el && !bad(el)) return { x, y, tag: el.tagName, id: el.id };
    }
    return null;
  });
  if (pt) await page.mouse.click(pt.x, pt.y);
  return pt;
}
// Does a bare AudioContext's clock advance here? If not, every audio check is NOT RUN, with this as
// the evidence, never a pass and never a code failure.
async function clockProbe(page) {
  return page.evaluate(async () => {
    const ac = new AudioContext(); const s0 = ac.state; try { await ac.resume(); } catch (e) {}
    const t0 = ac.currentTime; await new Promise(r => setTimeout(r, 400)); const t1 = ac.currentTime; const s1 = ac.state; ac.close();
    return { state0: s0, state1: s1, advanced: +(t1 - t0).toFixed(3), running: t1 - t0 > 0.2 };
  });
}

async function runJob(browser, base, j) {
  const ctx = await browser.newContext({ viewport: { width: j.vp[0], height: j.vp[1] } });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data') && !base.startsWith(u.origin)) external.push(r.url()); });
  const file = j.file || j.suite;
  const out = { suite: j.suite, id: j.id, vp: j.vp.join('x'), t: {} };
  let tm = Date.now(); const lap = k => { const n = Date.now(); out.t[k] = n - tm; tm = n; };
  try {
    await page.goto(base + '/rc/', { waitUntil: 'load' }); lap('load');
    await page.waitForTimeout(600);
    out.gesture = await trustedGesture(page); lap('gesture');
    if (j.audio) { out.clock = await clockProbe(page); lap('clock'); if (!out.clock.running) { out.status = 'NOT RUN'; out.why = 'audio clock frozen in this browser'; return out; } }
    let prev = null;
    for (const st of j.steps) {
      if (st.reload) { await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(600); continue; }
      if (st.shrinkTo) {
        await page.setViewportSize({ width: st.shrinkTo[0], height: st.shrinkTo[1] }); await page.waitForTimeout(700);
        prev = await page.evaluate(() => { const w = document.getElementById('wClose'), r = w.getBoundingClientRect();
          const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          return { docW: document.documentElement.scrollWidth, innerW: innerWidth, wClose: [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)],
            hitClose: !!(hit && (hit.id === 'wClose' || hit.closest('#wClose'))) }; });
        prev.pass = prev.docW <= prev.innerW && prev.wClose[0] >= 0 && prev.wClose[1] <= prev.innerW && prev.hitClose;
        continue;
      }
      prev = await page.evaluate(async ([src, fn, args]) => { const m = await import(src); return await m[fn](...(args || [])); },
        [base + '/qa/dashboard-' + (st.file || file) + '.qa.js', st.fn, st.args || []]); lap(st.fn);
      // A setup step must succeed, or the check after it proves nothing.
      if (st.setup && !(prev === true || (prev && prev.pass))) { out.status = 'FAIL'; out.why = 'setup step ' + st.fn + ' did not succeed'; out.result = prev; return out; }
    }
    if (j.rows) { out.rows = prev; out.pass = Array.isArray(prev) && prev.length > 0 && prev.every(r => r.pass); }
    else { out.result = prev; out.pass = !!(prev && prev.pass); }
    out.status = out.pass ? 'PASS' : 'FAIL';
  } catch (e) { out.status = 'ERROR'; out.why = String(e).slice(0, 500); }
  finally { out.pageErrors = errors; out.external = external; await ctx.close(); }
  return out;
}

(async () => {
  let server = null, base = arg('base', ''), baseServer = null, baseUrl = '';
  if (!base) { server = await serve(); base = 'http://127.0.0.1:' + server.address().port; }
  base = base.replace(/\/$/, '');
  if (BASE_ROOT) { baseServer = await serve(path.resolve(BASE_ROOT)); baseUrl = 'http://127.0.0.1:' + baseServer.address().port; }
  const jobs = J.filter(j => WANT.includes(j.suite) && (!ONLY || j.id.includes(ONLY)));
  if (!jobs.length) { console.error('No jobs matched.'); process.exit(2); }
  const all = {};
  for (const eng of ENGINES) {
    const bt = { chromium, webkit }[eng]; if (!bt) { console.error('Unknown engine ' + eng); process.exit(2); }
    const browser = await bt.launch({ headless: true, args: eng === 'chromium' ? ['--autoplay-policy=no-user-gesture-required'] : [] });
    const res = []; all[eng] = { version: browser.version(), results: res };
    // One warm-up load per engine, outside any job. WebKit's first navigation after launch once took
    // over 30 s (reproduced 0/3 when launched alone); a cold start is the harness's cost, not a check's.
    { const t = Date.now(), c = await browser.newContext(), p = await c.newPage();
      try { await p.goto(base + '/rc/', { waitUntil: 'load', timeout: 90000 }); console.log(`${eng.padEnd(8)} warm-up load ${Date.now() - t}ms`); }
      catch (e) { console.log(`${eng.padEnd(8)} warm-up FAILED ${String(e).slice(0, 200)}`); }
      finally { await c.close(); } }
    for (const j of jobs) {
      const t = Date.now(); const r = await runJob(browser, base, j); r.ms = Date.now() - t; res.push(r);
      if (j.base) {
        // Same check on the older build; "unchanged" means both pass and the keys are identical.
        if (!baseUrl) { r.status = 'NOT RUN'; r.why = 'needs --base-root (the build to compare against)'; }
        else { const b = await runJob(browser, baseUrl, j); r.baseResult = b.result; r.baseStatus = b.status;
          const same = !!(r.result && b.result && r.result.key && r.result.key === b.result.key);
          r.pass = r.status === 'PASS' && b.status === 'PASS' && same; r.status = r.pass ? 'PASS' : 'FAIL';
          if (!same) r.why = `key differs from base: ${r.result && r.result.key} vs ${b.result && b.result.key}`; }
      }
      const rowNote = r.rows ? ` (${r.rows.filter(x => x.pass).length}/${r.rows.length} rows)` : '';
      console.log(`${eng.padEnd(8)} ${r.status.padEnd(7)} ${(j.suite + ':' + j.id).padEnd(42)} ${r.vp.padEnd(9)} ${String(r.ms).padStart(6)}ms${rowNote}${r.why ? '  ' + r.why : ''}${r.external.length ? '  EXTERNAL:' + r.external.length : ''}${r.pageErrors.length ? '  PAGEERR:' + r.pageErrors.length : ''}`);
      if (r.rows) r.rows.filter(x => !x.pass).forEach(x => console.log(`         row ${x.id} FAIL ${x.claim}  ${JSON.stringify(x.ev).slice(0, 300)}`));
      else if (r.status === 'FAIL') console.log('         ' + JSON.stringify(r.result).slice(0, 600));
    }
    await browser.close();
  }
  if (server) server.close();
  if (baseServer) baseServer.close();
  const summary = Object.fromEntries(Object.entries(all).map(([e, v]) => [e, { version: v.version,
    pass: v.results.filter(r => r.status === 'PASS').length, fail: v.results.filter(r => r.status === 'FAIL').length,
    error: v.results.filter(r => r.status === 'ERROR').length, notRun: v.results.filter(r => r.status === 'NOT RUN').length,
    external: v.results.reduce((n, r) => n + r.external.length, 0), total: v.results.length }]));
  console.log('\nSUMMARY ' + JSON.stringify(summary));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base, when: new Date().toISOString(), summary, all }, null, 1));
  process.exit(Object.values(summary).every(s => s.pass === s.total) ? 0 : 1);
})();
