/**
 * Athene e2e — full pipeline
 *
 * Phase 1: Login (uses existing Chrome Google session)
 * Phase 2: Connect Google Drive via Nango
 *           → Click "Integrate Tool" → AddIntegrationDialog
 *           → Click Google Drive → handleConnect fires
 *           → Nango ConnectUI iframe (#connect-ui) appears
 *           → Click "Google Drive" inside iframe
 *           → Google OAuth popup opens (Chrome already signed in → just "Allow")
 *           → connect event fires → POST /api/admin/integrations saves connection
 *           → ConnectUI closes → DrivePickerModal opens
 * Phase 3: Folder picker — select first folder → PATCH /api/connections/[id]/configure
 *           → QStash → /api/worker/nango-fetch → fetchDriveChunks → embedBatch → document_embeddings
 * Phase 4: Wait until totalDocs > 0 (confirms embedding complete)
 * Phase 5: Chat — query via keyboard events → LangGraph → DeepSeek → SSE response
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const SHOTS = '/tmp/athene-screenshots';
fs.mkdirSync(SHOTS, { recursive: true });
// Clear previous run
try { fs.readdirSync(SHOTS).filter(f=>f.endsWith('.png')).forEach(f=>fs.unlinkSync(path.join(SHOTS,f))); } catch{}

let step = 0;
async function shot(page, label) {
  step++;
  const f = path.join(SHOTS, `${String(step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: f, fullPage: false }).catch(()=>{});
  console.log(`  📸 [${step}] ${label}`);
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// Type into React controlled input — fires real keyboard events so onChange updates state
async function reactType(page, selector, text) {
  await page.click(selector, { clickCount: 3 });
  await wait(150);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await wait(100);
  await page.keyboard.type(text, { delay: 18 });
  await wait(300);
}

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  Athene e2e: Login → Nango → Embed → Chat          ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // ── PHASE 0: Connect to Chrome ─────────────────────────────────────────
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('Phase 0 ✅ Connected to Chrome via CDP');
  } catch(e) {
    console.error('❌ CDP failed:', e.message);
    process.exit(1);
  }

  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  // ── PHASE 1: Login ─────────────────────────────────────────────────────
  console.log('\nPhase 1 — Login');
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await wait(2500);
  await shot(page, 'p1-signin');

  const alreadyIn = page.url().includes('/chat') || page.url().includes('/briefing');
  if (alreadyIn) {
    console.log('  ✅ Session active — already logged in');
  } else {
    const gBtn = await page.$('button:has-text("Google")').catch(()=>null);
    if (gBtn) {
      await gBtn.click();
      await wait(2500);
      if (page.url().includes('accounts.google.com')) {
        const tile = page.locator('text=mudxssiralam@gmail.com').first();
        if (await tile.isVisible({timeout:5000}).catch(()=>false)) {
          await tile.click(); await wait(3000);
        }
      }
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        const u = page.url();
        if (u.includes('localhost:3000') && !u.includes('/sign-in') && !u.includes('/sso-callback')) break;
        await wait(1500);
      }
    }
  }
  await wait(2000);
  await shot(page, 'p1-app');
  console.log('  URL:', page.url());

  // ── PHASE 2: Connect Google Drive via Nango ────────────────────────────
  console.log('\nPhase 2 — Connect Google Drive via Nango');

  await page.goto(`${BASE}/admin/integrations`, { waitUntil: 'networkidle', timeout: 25000 }).catch(()=>
    page.goto(`${BASE}/admin/integrations`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  );
  await wait(3000);
  await shot(page, 'p2-integrations');

  // Check existing connections
  const existingRes = await page.evaluate(async () => {
    const r = await fetch('/api/admin/integrations');
    const data = await r.json().catch(()=>({}));
    return { status: r.status, data };
  });
  console.log('  Integrations API status:', existingRes.status);

  const list = Array.isArray(existingRes.data) ? existingRes.data
    : existingRes.data?.integrations ?? [];
  const existing = list.find(i => i.provider === 'google_drive' && i.status === 'connected');

  let internalConnId = existing?.internalConnectionId ?? existing?.id ?? null;
  let nangoConnId    = existing?.connectionId ?? null;
  let totalDocs      = existing?.totalDocs ?? 0;

  if (existing) {
    console.log(`  ✅ Google Drive already connected`);
    console.log(`     internalId=${internalConnId} nangoId=${nangoConnId} docs=${totalDocs}`);
  } else {
    console.log('  Not connected — initiating Nango flow...');

    // Step A: Open "Integrate Tool" → AddIntegrationDialog
    const addBtns = ['button:has-text("Integrate Tool")', 'button:has-text("Add Integration")', 'button:has-text("Add Source")'];
    let opened = false;
    for (const sel of addBtns) {
      if (await page.locator(sel).first().isVisible({timeout:2000}).catch(()=>false)) {
        await page.locator(sel).first().click();
        await wait(1500);
        opened = true;
        console.log(`  Opened dialog via: ${sel}`);
        break;
      }
    }
    if (!opened) {
      await shot(page, 'p2-no-add-btn');
      console.log('  ⚠️ Could not open dialog');
    } else {
      await shot(page, 'p2-dialog');

      // Step B: Click Google Drive in AddIntegrationDialog
      const driveInDialog = page.locator('[data-provider="google_drive"], div:has-text("Google Drive") button, button:has-text("Google Drive")').first();
      // More reliable: find a clickable element containing "Google Drive" text
      const gdLocators = [
        page.locator('button').filter({ hasText: 'Google Drive' }).first(),
        page.locator('[role="button"]').filter({ hasText: 'Google Drive' }).first(),
        page.locator('div').filter({ hasText: /^Google Drive$/ }).first(),
        page.locator('text=Google Drive').first(),
      ];
      let driveClicked = false;
      for (const loc of gdLocators) {
        if (await loc.isVisible({timeout:2000}).catch(()=>false)) {
          await loc.click();
          driveClicked = true;
          console.log('  Clicked Google Drive in dialog');
          break;
        }
      }
      if (!driveClicked) {
        await shot(page, 'p2-no-drive-in-dialog');
        console.log('  ⚠️ Google Drive not found in dialog');
      } else {
        await wait(2000);
        await shot(page, 'p2-after-drive-click');

        // Step C: Wait for Nango ConnectUI iframe (#connect-ui)
        console.log('  Waiting for Nango ConnectUI iframe...');
        let iframeFound = false;
        for (let t = 0; t < 15; t++) {
          const el = await page.$('#connect-ui').catch(()=>null);
          if (el) { iframeFound = true; break; }
          await wait(1000);
        }

        if (!iframeFound) {
          await shot(page, 'p2-no-iframe');
          console.log('  ⚠️ ConnectUI iframe did not appear');
        } else {
          console.log('  ✅ Nango ConnectUI iframe appeared');
          await wait(3000); // wait for iframe to fully render providers
          await shot(page, 'p2-nango-iframe');

          // Step D: Click "Google Drive" INSIDE the Nango iframe
          const frame = page.frameLocator('#connect-ui');

          let nangoGDriveClicked = false;
          for (let t = 0; t < 10; t++) {
            try {
              const loc = frame.locator('text=Google Drive').first();
              if (await loc.isVisible({timeout:2000}).catch(()=>false)) {
                await loc.click();
                nangoGDriveClicked = true;
                console.log('  ✅ Clicked Google Drive inside Nango iframe');
                await wait(2500);
                await shot(page, 'p2-nango-gd-clicked');

                // Step D2: Nango shows confirmation screen "Link Google Drive Account"
                // with a blue "Connect" button — must click it to trigger OAuth popup
                const confirmConnect = frame.locator('button:has-text("Connect")').first();
                if (await confirmConnect.isVisible({timeout:5000}).catch(()=>false)) {
                  console.log('  Clicking "Connect" on Nango confirmation screen...');
                  // Set up popup listener BEFORE clicking Connect
                  const popupPromise = ctx.waitForEvent('page', {timeout:25000}).catch(()=>null);
                  await confirmConnect.click();
                  console.log('  ✅ Connect clicked — waiting for OAuth popup...');
                  await wait(2000);
                  await shot(page, 'p2-connect-btn-clicked');

                  // Step E: Handle Google OAuth popup
                  const oauthPage = await popupPromise;
                  if (oauthPage) {
                    console.log('  ✅ Google OAuth popup opened:', oauthPage.url().slice(0,80));
                    await wait(3000);
                    await shot(oauthPage, 'p2-oauth-popup');

                    const oUrl = oauthPage.url();
                    if (oUrl.includes('accounts.google.com')) {
                      // Account chooser — pick the primary account
                      const acctSelectors = [
                        'text=mudxssiralam@gmail.com',
                        'div[data-identifier="mudxssiralam@gmail.com"]',
                        '[aria-label*="mudxssiralam"]',
                      ];
                      for (const sel of acctSelectors) {
                        const tile = oauthPage.locator(sel).first();
                        if (await tile.isVisible({timeout:3000}).catch(()=>false)) {
                          console.log('  Clicking account tile:', sel);
                          await tile.click();
                          await wait(3000);
                          await shot(oauthPage, 'p2-oauth-account-clicked');
                          break;
                        }
                      }
                    }

                    // Step E2: Handle "Google hasn't verified this app" warning
                    // This appears when the OAuth app (Nango's dev app) isn't Google-verified
                    // Need: click "Advanced" → click "Go to Nango (unsafe)"
                    for (let attempt = 0; attempt < 3; attempt++) {
                      await wait(1500);
                      const advancedLink = oauthPage.locator('text=Advanced').first();
                      if (await advancedLink.isVisible({timeout:3000}).catch(()=>false)) {
                        console.log('  ⚠️ "Google hasn\'t verified this app" — clicking Advanced...');
                        await advancedLink.click();
                        await wait(2000);
                        await shot(oauthPage, 'p2-oauth-advanced-clicked');

                        // Click "Go to <appname> (unsafe)" — the proceed link
                        const proceedLocators = [
                          oauthPage.locator('text=/Go to.*unsafe/i').first(),
                          oauthPage.locator('text=/Proceed to/i').first(),
                          oauthPage.locator('a:has-text("unsafe")').first(),
                        ];
                        for (const ploc of proceedLocators) {
                          if (await ploc.isVisible({timeout:3000}).catch(()=>false)) {
                            console.log('  Clicking proceed (unsafe) link...');
                            await ploc.click();
                            await wait(3000);
                            await shot(oauthPage, 'p2-oauth-proceed-clicked');
                            break;
                          }
                        }
                        break;
                      }

                      // Check if we're past the warning already
                      const curUrl = oauthPage.url();
                      if (!curUrl.includes('accounts.google.com') || oauthPage.isClosed()) break;
                    }

                    // Step E3: Click Allow / Grant access on the consent screen
                    await wait(2000);
                    if (!oauthPage.isClosed()) {
                      await shot(oauthPage, 'p2-oauth-consent');
                      const allowBtns = [
                        oauthPage.locator('button:has-text("Allow")').first(),
                        oauthPage.locator('[id="submit_approve_access"]').first(),
                        oauthPage.locator('button:has-text("Continue")').first(),
                        oauthPage.locator('[data-action="allow"]').first(),
                      ];
                      for (const btn of allowBtns) {
                        if (await btn.isVisible({timeout:4000}).catch(()=>false)) {
                          const txt = await btn.textContent().catch(()=>'');
                          console.log(`  Clicking consent button: "${txt.trim()}"`);
                          await btn.click();
                          await wait(3000);
                          await shot(oauthPage, 'p2-oauth-allowed');
                          break;
                        }
                      }
                    }

                    // Wait for popup to close (Nango receives the OAuth token)
                    console.log('  Waiting for OAuth popup to close...');
                    for (let wt = 0; wt < 30; wt++) {
                      if (oauthPage.isClosed()) {
                        console.log(`  ✅ OAuth popup closed at t=${wt*2}s — Drive access granted`);
                        break;
                      }
                      if (wt % 5 === 0 && !oauthPage.isClosed()) {
                        await shot(oauthPage, `p2-oauth-wait-${wt*2}s`).catch(()=>{});
                        const url = oauthPage.url();
                        console.log(`  t=${wt*2}s | popup url: ${url.slice(0,80)}`);
                      }
                      await wait(2000);
                    }
                  } else {
                    console.log('  No popup detected after Connect click');
                  }
                } else {
                  // No confirmation screen — popup may have opened directly from provider click
                  console.log('  No confirmation screen — checking for direct popup...');
                  const popupPromise2 = ctx.waitForEvent('page', {timeout:10000}).catch(()=>null);
                  const oauthPage2 = await popupPromise2;
                  if (oauthPage2) {
                    console.log('  Direct popup:', oauthPage2.url().slice(0,80));
                  }
                }
                break;
              }
            } catch(e) { /* retry */ }
            await wait(1000);
          }

          if (!nangoGDriveClicked) {
            console.log('  ⚠️ Could not click Google Drive in Nango iframe');
            await shot(page, 'p2-iframe-content');
          }

          // Step F: Wait for connect event → POST /api/admin/integrations
          // Intercept the network request to capture internalConnectionId
          console.log('  Waiting for Nango connect event → POST /api/admin/integrations...');
          let connectSaved = false;
          for (let t = 0; t < 20; t++) {
            await wait(2000);
            const checkRes = await page.evaluate(async () => {
              const r = await fetch('/api/admin/integrations');
              const d = await r.json().catch(()=>({}));
              return Array.isArray(d) ? d : d?.integrations ?? [];
            });
            const conn = checkRes.find((i) => i.provider === 'google_drive');
            if (conn) {
              internalConnId = conn.internalConnectionId ?? conn.id;
              nangoConnId    = conn.connectionId;
              totalDocs      = conn.totalDocs ?? 0;
              console.log(`  ✅ Connection saved! internalId=${internalConnId}`);
              connectSaved = true;
              break;
            }
          }

          if (!connectSaved) {
            console.log('  ⚠️ Connection not saved after 40s');
          }

          // Step G: Close Nango ConnectUI (click X or Escape so DrivePickerModal can open)
          await shot(page, 'p2-before-close');
          try {
            const closeBtn = frame.locator('button[aria-label="Close"], button:has-text("×"), [class*="close"]').first();
            if (await closeBtn.isVisible({timeout:2000}).catch(()=>false)) {
              await closeBtn.click();
              console.log('  Closed ConnectUI via X button');
            } else {
              await page.keyboard.press('Escape');
              console.log('  Closed ConnectUI via Escape');
            }
          } catch(e) {
            await page.keyboard.press('Escape');
          }
          await wait(2000);
        }
      }
    }
  }

  await shot(page, 'p2-done');

  // ── PHASE 3: Drive Folder Picker ───────────────────────────────────────
  console.log('\nPhase 3 — Drive Folder Picker');

  // DrivePickerModal auto-opens from pendingConfigureQueue useEffect after ConnectUI closes
  // Wait up to 10s for it
  let pickerVisible = false;
  for (let t = 0; t < 10; t++) {
    const v = await page.locator('text=Start Syncing, text=Select Folders to Sync, text=Choose which Google Drive').first().isVisible({timeout:1000}).catch(()=>false);
    if (v) { pickerVisible = true; break; }
    await wait(1000);
  }

  // If not auto-opened, try clicking Configure on the Drive card
  if (!pickerVisible) {
    const configBtns = ['button:has-text("Configure")', 'button:has-text("Select Folders")', 'button:has-text("Manage")'];
    for (const sel of configBtns) {
      if (await page.locator(sel).first().isVisible({timeout:2000}).catch(()=>false)) {
        await page.locator(sel).first().click();
        await wait(2000);
        pickerVisible = await page.locator('text=Start Syncing').first().isVisible({timeout:3000}).catch(()=>false);
        break;
      }
    }
  }

  if (pickerVisible) {
    await shot(page, 'p3-picker');
    console.log('  ✅ Folder picker open — waiting for file list to load...');
    await wait(4000); // give API time to fetch Drive files

    // Look for any file/folder rows in the picker
    // DrivePickerModal renders: Square icon (checkbox button) + folder name + optional ChevronRight
    const checkboxBtns = page.locator('button').filter({ has: page.locator('svg') });
    const count = await checkboxBtns.count().catch(()=>0);
    console.log(`  File/folder items found: ${count}`);

    await shot(page, 'p3-picker-loaded');

    if (count > 0) {
      // Click the first folder checkbox (Square icon = unselected)
      // Avoid the back-navigation button and the search/close buttons
      // Find items in the ScrollArea content area
      const fileRows = page.locator('[class*="ScrollArea"] div[class*="flex items-center"], [class*="scroll-area"] div[class*="flex"]').first();
      const firstCheckbox = page.locator('[class*="ScrollArea"] button').first();

      let selected = false;
      // Try clicking first item
      try {
        const firstBtn = await page.$$('button').then(btns =>
          btns.find(async b => {
            const box = await b.boundingBox();
            return box && box.y > 200; // skip header buttons
          })
        );

        // More reliable: get all buttons in the file list area and click first visible one
        const allBtns = await page.$$('[class*="py-"] button, [class*="scroll"] button');
        for (const btn of allBtns) {
          const box = await btn.boundingBox();
          if (box && box.y > 150 && box.x < 100) { // leftmost buttons = checkboxes
            await btn.click();
            selected = true;
            console.log('  ✅ Selected first folder/file');
            break;
          }
        }

        if (!selected) {
          // Fallback: just click first button that's in the file list zone
          await firstCheckbox.click({ force: true });
          selected = true;
          console.log('  Selected first item (forced)');
        }
      } catch(e) {
        console.log('  Click error:', e.message);
      }

      await wait(500);
      await shot(page, 'p3-selected');

      // Click "Start Syncing"
      const startBtn = page.locator('button:has-text("Start Syncing")').first();
      if (await startBtn.isVisible({timeout:3000}).catch(()=>false)) {
        await startBtn.click();
        console.log('  ✅ Clicked "Start Syncing"');
        console.log('     → PATCH /api/connections/{id}/configure dispatched');
        console.log('     → QStash → /api/worker/nango-fetch → fetchDriveChunks → embedBatch');
        await wait(3000);
        await shot(page, 'p3-syncing');
      } else {
        console.log('  ⚠️ "Start Syncing" not found — nothing selected?');
        await shot(page, 'p3-no-start-btn');
      }
    } else {
      console.log('  ⚠️ No files/folders in picker. Drive may be loading or empty.');
      await shot(page, 'p3-empty');
    }
  } else {
    // Picker never opened — if we have a connection, trigger index directly
    console.log('  Picker did not open');
    if (internalConnId) {
      console.log(`  Triggering configure via API (internalId=${internalConnId})...`);
      // First browse to get a folder ID
      const browseRes = await page.evaluate(async (cid) => {
        const r = await fetch(`/api/connections/${cid}/browse?type=drive_files`);
        const d = await r.json().catch(()=>({}));
        return { status: r.status, files: d.files?.slice(0,3) ?? [] };
      }, internalConnId);
      console.log(`  Browse (${browseRes.status}): found ${browseRes.files.length} items`);
      browseRes.files.forEach(f => console.log(`    - ${f.name} (${f.id})`));

      const firstFolder = browseRes.files.find(f => f.mimeType === 'application/vnd.google-apps.folder') ?? browseRes.files[0];
      if (firstFolder) {
        const cfgRes = await page.evaluate(async (cid, fid) => {
          const r = await fetch(`/api/connections/${cid}/configure`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'google_drive', selectedFolderIds: [fid] }),
          });
          return { status: r.status, data: await r.json().catch(()=>({})) };
        }, internalConnId, firstFolder.id);
        console.log(`  Configure API (${cfgRes.status}):`, JSON.stringify(cfgRes.data).slice(0,100));
      }
    }
  }

  await shot(page, 'p3-done');

  // ── PHASE 4: Wait for embedding to complete ────────────────────────────
  console.log('\nPhase 4 — Waiting for document embedding...');
  console.log('  (QStash → /api/worker/nango-fetch → Nango fetches Drive files → embedBatch → document_embeddings)');

  let docsEmbedded = totalDocs > 0;
  let embeddedCount = totalDocs;

  if (!docsEmbedded) {
    const maxWaitMs = 8 * 60 * 1000; // 8 minutes max
    const startTime = Date.now();
    let lastCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      await wait(10000); // poll every 10s
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      const pollRes = await page.evaluate(async () => {
        const r = await fetch('/api/admin/integrations');
        const d = await r.json().catch(()=>({}));
        const items = Array.isArray(d) ? d : d?.integrations ?? [];
        const gd = items.find(i => i.provider === 'google_drive');
        return { status: gd?.status, totalDocs: gd?.totalDocs ?? 0 };
      });

      console.log(`  t=${elapsed}s | status=${pollRes.status} | totalDocs=${pollRes.totalDocs}`);

      if (pollRes.totalDocs > 0) {
        embeddedCount = pollRes.totalDocs;
        docsEmbedded = true;
        console.log(`  ✅ ${embeddedCount} document(s) embedded! Proceeding to chat.`);
        break;
      }

      if (pollRes.status === 'error') {
        console.log('  ❌ Sync errored — check /api/worker/nango-fetch logs');
        break;
      }

      if (pollRes.totalDocs > lastCount) lastCount = pollRes.totalDocs;
    }

    if (!docsEmbedded) {
      console.log('  ⚠️ No documents embedded after waiting. Check:');
      console.log('     1. QStash env var set? (QSTASH_TOKEN)');
      console.log('     2. Google Drive has at least one text/doc/pdf file');
      console.log('     3. /api/worker/nango-fetch is accessible (worker route, public in middleware)');
      console.log('  Proceeding to chat anyway to test LLM connectivity...');
    }
  } else {
    console.log(`  ✅ ${embeddedCount} document(s) already embedded`);
  }

  await page.goto(`${BASE}/files`, { waitUntil: 'networkidle', timeout: 20000 }).catch(()=>{});
  await wait(2000);
  await shot(page, 'p4-files');

  // ── PHASE 5: Chat query ────────────────────────────────────────────────
  console.log('\nPhase 5 — Chat + LLM');

  await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 20000 }).catch(()=>{});
  await wait(4000);
  await shot(page, 'p5-chat');

  const inputSel = 'input[placeholder*="synthesize"], input[placeholder*="Synthesize"]';
  const inp = await page.$(inputSel).catch(()=>null);

  if (!inp) {
    console.log('  ⚠️ Chat input not found');
    await shot(page, 'p5-no-input');
  } else {
    const query = docsEmbedded
      ? 'What documents do you have access to in my knowledge base? Please summarize what you can find.'
      : 'Hello, can you confirm you are working and connected?';

    console.log(`  Typing: "${query.slice(0,60)}..."`);
    await reactType(page, inputSel, query);
    await shot(page, 'p5-typed');

    // Submit — button is enabled only after reactType updates React state
    const submitBtn = await page.$('button[type="submit"]:not([disabled])');
    if (submitBtn) {
      await submitBtn.click();
      console.log('  ✅ Submitted → POST /api/agent → LangGraph → DeepSeek → SSE');
    } else {
      console.log('  Submit button still disabled — React state may not have updated');
      // Force submit via form
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
      });
      console.log('  Forced submit via SubmitEvent');
    }

    await wait(1000);
    await shot(page, 'p5-submitted');
    console.log('  Waiting for DeepSeek response...');

    let responded = false;
    for (let t = 1; t <= 18; t++) {
      await wait(5000);
      const body = await page.innerText('body').catch(()=>'');
      console.log(`    t=${t*5}s | body: ${body.length} chars`);
      if (body.length > 1200) {
        console.log('  ✅ LLM responded!');
        responded = true;
        await shot(page, 'p5-response');
        break;
      }
      if (t % 3 === 0) await shot(page, `p5-t${t*5}s`);
    }

    if (!responded) {
      await shot(page, 'p5-no-response');
      // Test agent directly to see error
      const agentTest = await page.evaluate(async () => {
        const r = await fetch('/api/agent', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello', threadId: crypto.randomUUID(), task_type: 'general' }),
        });
        const text = await r.text();
        return { status: r.status, body: text.slice(0, 300) };
      });
      console.log('  Direct /api/agent test:', agentTest.status, agentTest.body.slice(0,150));
    }
  }

  await wait(2000);
  await shot(page, 'p6-final');

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  Simulation complete                        ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nAll screenshots: ${SHOTS}`);
  console.log('Browser tab stays open.\n');

  await new Promise(()=>{});
})();
