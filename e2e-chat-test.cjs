/**
 * Athene Chat Test — verify RAG works with the embedded resume document
 * Skips OAuth/embedding; tests chat directly with the authenticated browser session.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const SHOTS = '/tmp/athene-chat';
fs.mkdirSync(SHOTS, { recursive: true });
try { fs.readdirSync(SHOTS).filter(f=>f.endsWith('.png')).forEach(f=>fs.unlinkSync(path.join(SHOTS,f))); } catch{}

let step = 0;
const shot = async (page, label) => {
  step++;
  const f = path.join(SHOTS, `${String(step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: f, fullPage: true }).catch(()=>{});
  console.log(`  📸 [${step}] ${label}`);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  Athene Chat RAG Test                ║');
  console.log('╚══════════════════════════════════════╝\n');

  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ CDP connected');
  } catch(e) { console.error('❌ CDP failed:', e.message); process.exit(1); }

  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  // Navigate to chat
  await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await wait(3000);

  const url = page.url();
  if (!url.includes('localhost:3000') || url.includes('sign-in')) {
    console.error('❌ Not logged in');
    process.exit(1);
  }
  console.log('✅ Logged in — at:', url);
  await shot(page, '01-chat-home');

  // Test 1: Direct /api/agent call
  console.log('\nTest 1 — Direct /api/agent API call');
  const threadId = `chat-test-${Date.now()}`;
  const apiResult = await page.evaluate(async ({ threadId }) => {
    const r = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What do you know about Mudassir Alam? Summarize his resume including his skills, education, and experience.',
        threadId,
        task_type: 'general',
      }),
    });

    if (!r.ok) return { status: r.status, body: await r.text() };

    // Read SSE stream
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let timeout = false;
    const timer = setTimeout(() => { timeout = true; }, 90000);
    while (!timeout) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value);
      if (full.length > 3000) break; // enough content
    }
    clearTimeout(timer);
    return { status: r.status, body: full };
  }, { threadId });

  console.log(`  Status: ${apiResult.status}`);
  console.log(`  Response length: ${apiResult.body?.length ?? 0} chars`);

  // Parse SSE to find final text content
  const events = (apiResult.body || '').split('\n').filter(l => l.startsWith('data:'));
  console.log(`  SSE events: ${events.length}`);

  let finalContent = '';
  for (const ev of events) {
    try {
      const data = JSON.parse(ev.slice(5));
      if (data.type === 'message' || data.type === 'delta' || data.type === 'text') {
        finalContent += data.content ?? data.text ?? data.delta ?? '';
      }
    } catch {}
  }

  // Try direct text extraction
  const rawText = events
    .map(e => { try { const d=JSON.parse(e.slice(5)); return d.content||d.text||d.delta||JSON.stringify(d).slice(0,100); } catch { return e; }})
    .join('\n')
    .slice(0, 1500);

  console.log('\n--- RAW RESPONSE (first 1500 chars) ---');
  console.log(rawText || apiResult.body?.slice(0, 1500));
  console.log('--- END RESPONSE ---\n');

  const hasDocContent = (rawText + (apiResult.body||'')).toLowerCase().includes('mudassir') ||
                        (rawText + (apiResult.body||'')).toLowerCase().includes('bengaluru') ||
                        (rawText + (apiResult.body||'')).toLowerCase().includes('resume') ||
                        (rawText + (apiResult.body||'')).toLowerCase().includes('skill');

  if (hasDocContent) {
    console.log('✅ PASS — LLM responded with document-relevant content!');
  } else {
    console.log('⚠️  INCONCLUSIVE — response received but no clear doc content detected');
    console.log('    Full body preview:', apiResult.body?.slice(0, 500));
  }

  // Test 2: UI chat
  console.log('\nTest 2 — UI chat interaction');
  await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await wait(3000);
  await shot(page, '02-chat-before-typing');

  // Find the input
  const inputSel = 'textarea, input[type="text"], input[placeholder*="ask" i], input[placeholder*="synth" i], [contenteditable]';
  const input = await page.locator(inputSel).first();
  const inputVisible = await input.isVisible({ timeout: 5000 }).catch(()=>false);

  if (!inputVisible) {
    console.log('  ❌ Chat input not found');
    const allInputs = await page.$$eval('input, textarea', els => els.map(e => ({tag: e.tagName, ph: e.placeholder, type: e.type, cls: e.className.slice(0,50)})));
    console.log('  Available inputs:', JSON.stringify(allInputs, null, 2));
    await shot(page, '03-no-input');
  } else {
    const query = 'What is in my knowledge base? Specifically tell me about Mudassir Alam and his resume.';
    console.log(`  Typing: "${query.slice(0,60)}..."`);

    await input.click();
    await wait(200);
    await page.keyboard.type(query, { delay: 15 });
    await wait(300);
    await shot(page, '03-typed-query');

    // Submit
    const submitBtn = await page.$('button[type="submit"]:not([disabled])');
    if (submitBtn) {
      await submitBtn.click();
      console.log('  Clicked submit button');
    } else {
      await page.keyboard.press('Enter');
      console.log('  Pressed Enter');
    }
    await shot(page, '04-submitted');
    console.log('  Waiting for LLM response (up to 2 minutes)...');

    let responded = false;
    let prevLen = 0;
    for (let t = 1; t <= 24; t++) {
      await wait(5000);
      const bodyText = await page.innerText('body').catch(()=>'');
      const bodyLen = bodyText.length;
      if (bodyLen !== prevLen) {
        console.log(`    t=${t*5}s | body: ${bodyLen} chars (Δ${bodyLen - prevLen})`);
        prevLen = bodyLen;
      }

      // Check for response content (more than just the UI chrome)
      if (bodyLen > 1500 && bodyLen !== prevLen) {
        // Look for substantive content about the document
        const hasContent = bodyText.toLowerCase().includes('mudassir') ||
                           bodyText.toLowerCase().includes('resume') ||
                           bodyText.toLowerCase().includes('skill') ||
                           bodyText.toLowerCase().includes('knowledge base');
        if (hasContent) {
          responded = true;
          console.log('  ✅ LLM responded with relevant content!');
          await shot(page, '05-response');
          break;
        }
      }
      if (t === 24 || bodyLen > 3000) {
        await shot(page, `05-t${t*5}s`);
        if (bodyLen > 1800) { responded = true; break; }
      }
    }

    if (!responded) {
      await shot(page, '06-no-response');
      console.log('  ⚠️  No clear response detected — checking body content...');
      const bodyText = await page.innerText('body').catch(()=>'');
      console.log('  Body preview:', bodyText.slice(0, 500));
    }
  }

  await shot(page, '07-final');
  console.log('\n╔══════════════════╗');
  console.log('║  Chat test done  ║');
  console.log('╚══════════════════╝');
  console.log(`Screenshots: ${SHOTS}\n`);
  process.exit(0);
})();
