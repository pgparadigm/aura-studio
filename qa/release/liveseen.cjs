// A real browser in Chromium and in WebKit loads the live /rc/ and the live root, and reports the app.js address
// each page asked for and the APP_VERSION inside the bytes it received. Exit 0 only when both engines see both
// expected versions; a page that loads no app.js, or bytes with no APP_VERSION, is a failure, not a pass.
//   usage: node qa/release/liveseen.cjs RC_VERSION ROOT_VERSION
const path = require('path');
const PW = require(process.env.AURA_QA_PW || path.join(process.env.HOME, '.local/share/aura-qa/node_modules/playwright-core'));
const SITE = process.env.AURA_SITE || 'https://pgparadigm.github.io/aura-studio';
const [RC, ROOT] = process.argv.slice(2);
if (!RC || !ROOT) { console.log('usage: node qa/release/liveseen.cjs RC_VERSION ROOT_VERSION'); process.exit(2); }
(async () => {
  let ok = true, seenPages = 0;
  for (const eng of ['chromium', 'webkit']) {
    const b = await PW[eng].launch({ headless: true });
    for (const [where, want] of [[SITE + '/rc/', RC], [SITE + '/', ROOT]]) {
      const ctx = await b.newContext(), pg = await ctx.newPage(), seen = [];
      pg.on('response', async r => { if (/\/app\.js(\?|$)/.test(r.url())) { try { const t = await r.text();
        seen.push({ url: r.url(), status: r.status(), version: (t.match(/APP_VERSION='([^']+)'/) || [])[1] || 'NONE' }); }
        catch (e) { seen.push({ url: r.url(), status: r.status(), version: 'UNREADABLE' }); } } });
      await pg.goto(where + '?fresh=' + Date.now(), { waitUntil: 'load' }); await pg.waitForTimeout(1500);
      const pass = seen.length === 1 && seen[0].status === 200 && seen[0].version === want && seen[0].url.includes('v=' + want);
      if (!pass) ok = false; seenPages++;
      console.log((pass ? 'OK  ' : 'FAIL') + ' ' + eng.padEnd(8) + ' ' + where + ' want ' + want + ' saw ' + (seen.length ? JSON.stringify(seen) : 'NO app.js RESPONSE'));
      await ctx.close();
    }
    await b.close();
  }
  console.log('examined ' + seenPages + ' page loads (2 engines x 2 addresses): ' + (ok ? 'all as expected' : 'NOT as expected'));
  process.exit(ok && seenPages === 4 ? 0 : 1);
})().catch(e => { console.log('ERROR ' + (e && e.message)); process.exit(1); });
