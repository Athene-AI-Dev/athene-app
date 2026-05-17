/**
 * tests/e2e/helpers.ts
 *
 * Shared utilities for Playwright E2E specs.
 * All locators are derived from the actual app DOM — see:
 *   - app/(dashboard)/chat/page.tsx          (input, form, submit button)
 *   - components/chat/message-list.tsx       (data-testid, data-loading)
 *   - components/chat/hitl-modal.tsx         (data-testid="approval-card")
 */

import type { Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Sign in programmatically via Clerk's testing SDK.
 * Bypasses the sign-in UI and any 2FA using a backend token exchange.
 * Requires CLERK_SECRET_KEY in env (loaded from .env.local).
 */
export async function signIn(page: Page, email: string, _password: string): Promise<void> {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  if (!page.url().includes("sign-in")) return;
  await clerk.signIn({ page, emailAddress: email });
}

/**
 * Type a message into the chat input and submit.
 *
 * The chat input is a React controlled <input> inside <form onSubmit={handleSubmit}>.
 * Playwright's fill() bypasses React's synthetic onChange, so we use the native
 * HTMLInputElement prototype setter + dispatched events to update React state,
 * then click the form's submit button (which shows a Send icon, no text label).
 *
 * Placeholder (actual): "Ask Athene to synthesize anything..." (general mode)
 *                        "Synthesize department-wide BI patterns..." (analytical mode)
 */
export async function sendChatMessage(page: Page, message: string): Promise<void> {
  const chatInput = page.locator("form input").first();
  await chatInput.waitFor({ state: "visible", timeout: 10_000 });
  await chatInput.click();

  // pressSequentially generates real keystroke events so React's onChange fires
  // and updates the input state — the submit button is disabled until input.trim() != "".
  await chatInput.pressSequentially(message, { delay: 20 });

  // Wait for React to flush state updates from typing before submitting.
  await page.waitForTimeout(300);

  // Click the submit button directly (more reliable than pressing Enter, which can
  // fail if focus drifts or the form has complex event handling).
  const submitBtn = page.locator("form button[type='submit']").first();
  await submitBtn.waitFor({ state: "visible", timeout: 5_000 });
  await submitBtn.click();
}

/**
 * Wait for the chat AI response to finish streaming.
 *
 * The submit button renders a Loader2 spinner (.animate-spin) while isLoading=true
 * (chat/page.tsx line 512). We wait for it to appear then disappear.
 *
 * If the response is so fast the spinner never becomes visible (rare), the
 * second waitFor on "hidden" resolves immediately since the element is already gone.
 */
export async function waitForChatResponse(page: Page, timeout = 60_000): Promise<void> {
  // Wait for the Loader2 spinner that appears inside the submit button while isLoading=true.
  // "button .animate-spin" is a permissive descendant selector that matches the svg Loader2
  // renders with animate-spin regardless of button nesting depth.
  const spinner = page.locator("button .animate-spin");
  await spinner.first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  await spinner.first().waitFor({ state: "hidden", timeout }).catch(() => {});
}

/**
 * Get the text content of the last assistant message in the chat.
 * Uses the data-testid attribute added in message-list.tsx.
 * Call only after waitForChatResponse() has resolved.
 */
export async function getLastAssistantMessage(page: Page): Promise<string> {
  const msg = page.locator("[data-testid=\"assistant-message\"]").last();
  return (await msg.textContent()) ?? "";
}
