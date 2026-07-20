import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Random delay between actions to mimic human behaviour.
 * Default: 30–90 seconds (between LinkedIn actions)
 */
export function randomDelay(minMs = env.playwright.minDelayMs, maxMs = env.playwright.maxDelayMs): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  logger.debug(`[Delay] Waiting ${(delay / 1000).toFixed(1)}s before next action...`);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Short delay for UI interactions (clicking, filling, navigating within a page).
 */
export function shortDelay(minMs = 1200, maxMs = 3500): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Tiny delay for keystrokes.
 */
export function keystrokeDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 150) + 40;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Type text character-by-character to mimic human typing.
 */
export async function humanType(page: import('playwright').Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await shortDelay(300, 600);
  for (const char of text) {
    await page.keyboard.type(char);
    await keystrokeDelay();
  }
}

/**
 * Occasionally scroll the page slightly (looks more human).
 */
export async function humanScroll(page: import('playwright').Page): Promise<void> {
  const scrollAmount = Math.floor(Math.random() * 400) + 100;
  await page.evaluate((amount) => { (window as any).scrollBy(0, amount); }, scrollAmount);
  await shortDelay(600, 1200);
}
