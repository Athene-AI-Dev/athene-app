/**
 * Athene end-to-end user simulation
 * Walks: landing → sign-in → Google OAuth (mudxssiralam@gmail.com)
 *        → dashboard → Nango connections check → Drive folder picker → chat query
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOTS = '/tmp/athene-screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

let step = 0;
async function shot(page, label) {
  step++;
  const file = path.join(SCREENSHOTS, `${String(step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${step}: ${label} → ${file}`);
  return file;
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // Use a persistent context so Google cookies from prior sign-ins carry over
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    // Disguise as a normal browser to help Google OAuth pass
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // ── 1. Landing page ──────────────────────────────────────────
    console.log('\n=== STEP 1: Landing page ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await shot(page, 'landing');

    // ── 2. Click "GET STARTED" ───────────────────────────────────
    console.log('\n=== STEP 2: Click GET STARTED ===');
    const getStarted = page.getByRole('link', { name: /get started/i }).first();
    await getStarted.waitFor({ timeout: 5000 });
    await getStarted.click();
    await page.waitForURL(/sign-(in|up)/, { timeout: 10000 });
    await shot(page, 'clerk-signin');

    // ── 3. Click "Continue with Google" ─────────────────────────
    console.log('\n=== STEP 3: Clerk → Continue with Google ===');
    const googleBtn = page.getByRole('button', { name: /google/i }).first();
    await googleBtn.waitFor({ timeout: 8000 });
    await googleBtn.click();
    await wait(3000);
    await shot(page, 'google-accounts-chooser');

    // ── 4. Select the mudxssiralam account ───────────────────────
    console.log('\n=== STEP 4: Select Google account ===');
    // Google shows account chooser — pick by email
    const url = page.url();
    console.log('Current URL:', url);

    if (url.includes('accounts.google.com')) {
      // Try to find the account tile
      const accountTile = page.locator(`text=mudxssiralam@gmail.com`).first();
      const found = await accountTile.isVisible({ timeout: 5000 }).catch(() => false);
      if (found) {
        console.log('Found account tile — clicking');
        await accountTile.click();
        await wait(3000);
        await shot(page, 'google-after-account-select');
      } else {
        // Try "Use another account" then enter email
        const anotherBtn = page.locator('text=Use another account').first();
        const anotherVisible = await anotherBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (anotherVisible) {
          await anotherBtn.click();
          await wait(1000);
          await page.fill('input[type="email"]', 'mudxssiralam@gmail.com');
          await page.keyboard.press('Enter');
          await wait(2000);
          await shot(page, 'google-email-entered');
        } else {
          // Maybe we're at the email input directly
          const emailInput = page.locator('input[type="email"]').first();
          const emailVisible = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);
          if (emailVisible) {
            await emailInput.fill('mudxssiralam@gmail.com');
            await page.keyboard.press('Enter');
            await wait(2000);
            await shot(page, 'google-email-entered');
          } else {
            console.log('Could not find Google account chooser or email input');
            await shot(page, 'google-unexpected-state');
          }
        }
      }
    } else if (url.includes('localhost:3000')) {
      console.log('Already redirected back to app — Clerk may have had an existing session');
      await shot(page, 'app-after-google-redirect');
    }

    // Wait for redirect back to app
    console.log('\n=== Waiting for OAuth redirect back to localhost:3000 ===');
    await wait(4000);
    const currentUrl = page.url();
    console.log('URL after OAuth flow:', currentUrl);
    await shot(page, 'post-oauth-state');

    // ── 5. If we're back in the app, check dashboard ─────────────
    if (currentUrl.includes('localhost:3000') && !currentUrl.includes('sign-in')) {
      console.log('\n=== STEP 5: App loaded — checking dashboard ===');
      await wait(2000);
      await shot(page, 'dashboard-home');

      // Try navigating to admin integrations
      console.log('\n=== STEP 6: Check integrations (Nango connections) ===');
      await page.goto(`${BASE}/admin/integrations`, { waitUntil: 'networkidle', timeout: 15000 });
      await wait(2000);
      await shot(page, 'admin-integrations');

      // Check Google Drive exists and has a configure button
      const driveMention = await page.locator('text=Google Drive').first().isVisible({ timeout: 5000 }).catch(() => false);
      console.log('Google Drive listed:', driveMention);

      // ── 7. Navigate to files or configure Drive ───────────────
      console.log('\n=== STEP 7: Check files page ===');
      await page.goto(`${BASE}/files`, { waitUntil: 'networkidle', timeout: 15000 });
      await wait(2000);
      await shot(page, 'files-page');

      // ── 8. Go to chat and send a query ───────────────────────
      console.log('\n=== STEP 8: Chat interface ===');
      await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 15000 });
      await wait(3000);
      await shot(page, 'chat-page');

      // Try to find the chat input and send a message
      const chatInput = page.locator('textarea, input[placeholder*="message"], input[placeholder*="ask"], input[placeholder*="Ask"]').first();
      const inputVisible = await chatInput.isVisible({ timeout: 5000 }).catch(() => false);
      if (inputVisible) {
        console.log('Found chat input — typing query');
        await chatInput.click();
        await chatInput.fill('What documents are in my knowledge base?');
        await shot(page, 'chat-query-typed');
        await page.keyboard.press('Enter');
        await wait(8000); // Wait for LLM response
        await shot(page, 'chat-response');
      } else {
        console.log('Chat input not found');
        await shot(page, 'chat-no-input');
      }
    } else {
      console.log('Not back in app yet — OAuth may need manual completion');
      console.log('Current URL:', currentUrl);

      // Wait longer for OAuth to complete
      await wait(8000);
      await shot(page, 'waiting-for-oauth');
      const finalUrl = page.url();
      console.log('Final URL:', finalUrl);

      if (finalUrl.includes('localhost:3000') && !finalUrl.includes('sign-in')) {
        // Made it back — go to chat
        await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 15000 });
        await wait(2000);
        await shot(page, 'chat-after-long-wait');
      }
    }

  } catch (err) {
    console.error('Error during simulation:', err.message);
    await shot(page, 'error-state');
  }

  console.log('\n=== Simulation complete — browser staying open for 15s ===');
  await wait(15000);
  await browser.close();
  console.log('Done.');
})();
