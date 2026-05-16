/**
 * Athene Pipeline Runner (Iteration 2)
 *
 * Assumes Google Drive is already connected via Nango (connection in DB).
 * Skips OAuth. Goes straight to:
 *   1. Verify integrations API shows the connection
 *   2. Browse Drive to find files/folders
 *   3. Call PATCH /api/connections/[id]/configure to trigger embedding
 *   4. Poll for totalDocs > 0
 *   5. Chat with a document query
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const SHOTS = '/tmp/athene-pipeline';
fs.mkdirSync(SHOTS, { recursive: true });
try { fs.readdirSync(SHOTS).filter(f=>f.endsWith('.png')).forEach(f=>fs.unlinkSync(path.join(SHOTS,f))); } catch{}

let step = 0;
const shot = async (page, label) => {
  step++;
  const f = path.join(SHOTS, `${String(step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: f }).catch(()=>{});
  console.log(`  📸 [${step}] ${label}`);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

const reactType = async (page, selector, text) => {
  await page.click(selector, { clickCount: 3 });
  await wait(150);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await wait(100);
  await page.keyboard.type(text, { delay: 18 });
  await wait(300);
};

(async () => {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  Athene Pipeline: Connect → Embed → Chat           ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // ── Connect CDP ──────────────────────────────────────────────
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ CDP connected');
  } catch(e) { console.error('❌ CDP failed:', e.message); process.exit(1); }

  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  // ── Login ───────────────────────────────────────────────────
  await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await wait(3000);
  const url = page.url();
  console.log('Session URL:', url);
  if (!url.includes('localhost:3000') || url.includes('sign-in')) {
    console.error('❌ Not logged in — go to localhost:3000, sign in, then re-run');
    process.exit(1);
  }
  console.log('✅ Logged in\n');
  await shot(page, 'chat-loaded');

  // ── Step 1: Check integrations API ──────────────────────────
  console.log('Step 1 — Check /api/admin/integrations');
  await page.goto(`${BASE}/admin/integrations`, { waitUntil: 'networkidle', timeout: 20000 }).catch(()=>{});
  await wait(2000);

  const intRes = await page.evaluate(async () => {
    const r = await fetch('/api/admin/integrations');
    const d = await r.json().catch(()=>({}));
    return { status: r.status, data: d };
  });
  console.log(`  API status: ${intRes.status}`);

  const list = Array.isArray(intRes.data) ? intRes.data : (intRes.data?.integrations ?? []);
  console.log(`  Integrations found: ${list.length}`);
  list.forEach(i => console.log(`    - ${i.provider} | status=${i.status} | internalId=${i.internalConnectionId} | docs=${i.totalDocs}`));

  const gdConn = list.find(i => i.provider === 'google_drive' || i.provider === 'google-drive');
  if (!gdConn) {
    console.log('  ❌ No Google Drive connection found!');
    console.log('  Raw response:', JSON.stringify(intRes.data).slice(0, 300));
    await shot(page, 'no-connection');
    process.exit(1);
  }

  const internalConnId = gdConn.internalConnectionId;
  console.log(`  ✅ Found Google Drive: internalId=${internalConnId} docs=${gdConn.totalDocs}`);

  // ── Step 2: Browse Drive ─────────────────────────────────────
  console.log('\nStep 2 — Browse Google Drive files');
  const browseRes = await page.evaluate(async (cid) => {
    const r = await fetch(`/api/connections/${cid}/browse?type=drive_files`);
    const d = await r.json().catch(()=>({}));
    return { status: r.status, files: d.files ?? d.items ?? [], error: d.error };
  }, internalConnId);
  console.log(`  Browse status: ${browseRes.status}`);
  if (browseRes.error) console.log(`  Error: ${browseRes.error}`);
  console.log(`  Files/folders: ${browseRes.files.length}`);
  browseRes.files.slice(0, 5).forEach(f => console.log(`    - [${f.mimeType?.includes('folder') ? 'DIR' : 'FILE'}] ${f.name} (${f.id})`));

  // ── Step 3: Trigger configure / embedding ────────────────────
  console.log('\nStep 3 — Trigger embedding via PATCH /api/connections/[id]/configure');

  let folderIds = [];
  // Prefer folders; fall back to any file
  const folders = browseRes.files.filter(f => f.mimeType?.includes('folder'));
  const files   = browseRes.files.filter(f => !f.mimeType?.includes('folder'));

  if (folders.length > 0) {
    folderIds = [folders[0].id];
    console.log(`  Selected folder: ${folders[0].name} (${folders[0].id})`);
  } else if (files.length > 0) {
    folderIds = [files[0].id];
    console.log(`  No folders — using first file: ${files[0].name} (${files[0].id})`);
  } else {
    // If browse returned nothing, try without folder filter — use root
    console.log('  No files in browse — using root (empty selectedFolderIds triggers full sync)');
  }

  const cfgRes = await page.evaluate(async ({ cid, ids }) => {
    const r = await fetch(`/api/connections/${cid}/configure`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google_drive', selectedFolderIds: ids }),
    });
    const d = await r.json().catch(()=>({}));
    return { status: r.status, data: d };
  }, { cid: internalConnId, ids: folderIds });

  console.log(`  Configure status: ${cfgRes.status}`);
  console.log(`  Configure response: ${JSON.stringify(cfgRes.data).slice(0, 200)}`);

  if (cfgRes.status !== 200 && cfgRes.status !== 201) {
    console.log(`  ❌ Configure failed — trying with empty folderIds (full root sync)...`);
    const cfgRes2 = await page.evaluate(async ({ cid }) => {
      const r = await fetch(`/api/connections/${cid}/configure`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google_drive', selectedFolderIds: [] }),
      });
      return { status: r.status, data: await r.json().catch(()=>({})) };
    }, { cid: internalConnId });
    console.log(`  Retry configure status: ${cfgRes2.status} | ${JSON.stringify(cfgRes2.data).slice(0,150)}`);
  }
  await shot(page, 'configure-triggered');

  // ── Step 4: Poll for document embeddings ─────────────────────
  console.log('\nStep 4 — Polling for documents to be embedded...');
  console.log('  (QStash → tunnel → /api/worker/nango-fetch → fetchDriveChunks → embedBatch)');

  const maxWait = 10 * 60 * 1000; // 10 min
  const start   = Date.now();
  let embedded  = false;
  let docCount  = 0;

  while (Date.now() - start < maxWait) {
    await wait(12000);
    const elapsed = Math.round((Date.now() - start) / 1000);
    const poll = await page.evaluate(async () => {
      const r = await fetch('/api/admin/integrations');
      const d = await r.json().catch(()=>({}));
      const items = Array.isArray(d) ? d : (d?.integrations ?? []);
      const gd = items.find(i => i.provider === 'google_drive' || i.provider === 'google-drive');
      return { status: gd?.status, docs: gd?.totalDocs ?? 0 };
    });
    console.log(`  t=${elapsed}s | status=${poll.status} | docs=${poll.docs}`);

    if (poll.docs > 0) {
      docCount = poll.docs;
      embedded = true;
      console.log(`  ✅ ${docCount} document(s) embedded!`);
      break;
    }
    if (poll.status === 'error') {
      console.log('  ❌ Sync status is error — check Next.js logs for /api/worker/nango-fetch errors');
      break;
    }
    if (elapsed % 60 === 0) await shot(page, `p4-wait-${elapsed}s`);
  }

  if (!embedded) {
    console.log('  ⚠️  No docs after polling. Checking tunnel health...');
    const tunnelOk = await page.evaluate(async () => {
      try {
        const r = await fetch('https://rather-recipe-lawsuit-operator.trycloudflare.com/');
        return r.status;
      } catch(e) { return e.message; }
    });
    console.log(`  Tunnel status from browser: ${tunnelOk}`);
    console.log('  Checking Next.js logs for worker errors...');
  }
  await shot(page, 'p4-done');

  // ── Step 5: Chat ─────────────────────────────────────────────
  console.log('\nStep 5 — Chat query');
  await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 20000 }).catch(()=>{});
  await wait(4000);
  await shot(page, 'p5-chat');

  const inputSel = 'input[placeholder*="synthesize"], input[placeholder*="Synthesize"], input[placeholder*="Ask"], textarea';
  const hasInput = await page.locator(inputSel).first().isVisible({ timeout: 5000 }).catch(()=>false);

  if (!hasInput) {
    console.log('  ❌ Chat input not found');
    const inputs = await page.$$eval('input, textarea', els => els.map(e => ({ ph: e.placeholder, cls: e.className.slice(0,60) })));
    console.log('  Available inputs:', JSON.stringify(inputs));
    await shot(page, 'p5-no-input');
  } else {
    const query = embedded
      ? 'What documents do you have access to in my knowledge base? List and briefly summarize each one.'
      : 'Hello, are you working? Can you confirm the system is operational?';
    console.log(`  Query: "${query.slice(0, 80)}..."`);

    await reactType(page, inputSel, query);
    await shot(page, 'p5-typed');

    // Try submit
    const btnEnabled = await page.$('button[type="submit"]:not([disabled])').catch(()=>null);
    if (btnEnabled) {
      await btnEnabled.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('  ✅ Submitted → waiting for response...');
    await shot(page, 'p5-submitted');

    let responded = false;
    for (let t = 1; t <= 20; t++) {
      await wait(5000);
      const bodyLen = (await page.innerText('body').catch(()=>'')).length;
      console.log(`    t=${t*5}s | body: ${bodyLen} chars`);
      if (bodyLen > 1200) {
        console.log('  ✅ LLM responded!');
        responded = true;
        await shot(page, 'p5-response');
        break;
      }
      if (t % 4 === 0) await shot(page, `p5-t${t*5}s`);
    }

    if (!responded) {
      await shot(page, 'p5-no-response');
      // Direct API test
      const agentTest = await page.evaluate(async () => {
        const r = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello', threadId: crypto.randomUUID(), task_type: 'general' }),
        });
        return { status: r.status, body: (await r.text()).slice(0, 400) };
      });
      console.log(`  Direct /api/agent: status=${agentTest.status}`);
      console.log(`  Body: ${agentTest.body}`);
    }
  }

  await shot(page, 'p6-final');
  console.log('\n╔═══════════════════════════╗');
  console.log('║  Run complete              ║');
  console.log('╚═══════════════════════════╝');
  console.log(`Screenshots: ${SHOTS}\n`);
  await new Promise(()=>{});
})();
