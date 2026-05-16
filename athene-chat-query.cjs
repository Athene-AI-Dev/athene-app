const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOTS = '/tmp/athene-screenshots';
let step = 20;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, label) {
  step++;
  const f = path.join(SHOTS, `${String(step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: f }).catch(() => {});
  console.log(`📸 [${step}] ${label}`);
  return f;
}

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];

  const pages = ctx.pages();
  let page = pages.find(p => p.url().includes('localhost:3000/chat'));
  if (!page) {
    page = pages[0];
    await page.goto('http://localhost:3000/chat', { waitUntil: 'networkidle', timeout: 20000 });
    await wait(3000);
  }

  console.log('On page:', page.url());
  await shot(page, 'chat-before-query');

  // Try all input selectors
  const selectors = [
    'input[placeholder*="synthesize"]',
    'input[placeholder*="Synthesize"]',
    'input[placeholder*="Ask"]',
    'input[placeholder*="ask"]',
    'input[class*="bg-transparent"]',
    'input[type="text"]',
    'textarea',
  ];

  let inp = null;
  for (const sel of selectors) {
    inp = await page.$(sel).catch(() => null);
    if (inp) {
      const visible = await page.locator(sel).first().isVisible().catch(() => false);
      if (visible) {
        console.log('Found input with selector:', sel);
        break;
      }
      inp = null;
    }
  }

  if (!inp) {
    console.log('Input not found. Inputs on page:');
    const inputs = await page.$$('input, textarea');
    for (const i of inputs) {
      const ph = await i.getAttribute('placeholder').catch(() => '');
      const cls = await i.getAttribute('class').catch(() => '');
      console.log(' - placeholder:', ph, '| class:', cls.slice(0, 60));
    }
    await shot(page, 'no-input-debug');
    process.exit(1);
  }

  await inp.click();
  await wait(500);
  await inp.fill('What documents do you have access to in my knowledge base? Please summarize what you can find.');
  await shot(page, 'query-typed');

  await page.keyboard.press('Enter');
  console.log('Query sent — waiting for LLM response...');

  let gotResponse = false;
  for (let i = 1; i <= 8; i++) {
    await wait(6000);
    await shot(page, `response-t${i*6}s`);
    const bodyLen = (await page.innerText('body').catch(() => '')).length;
    console.log(`  t=${i*6}s | body: ${bodyLen} chars`);
    if (bodyLen > 2000) {
      console.log('✅ LLM response received!');
      gotResponse = true;
      break;
    }
  }

  if (!gotResponse) console.log('⚠️  No response after 48s');
  await shot(page, 'simulation-complete');
  console.log('\n=== All done. Screenshots in:', SHOTS, '===');
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
