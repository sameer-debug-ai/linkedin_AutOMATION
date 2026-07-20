import { BrowserContext } from 'playwright';
import { shortDelay, humanType, humanScroll } from './human-delay';
import { detectCaptcha } from './linkedin-login';
import { logger } from '../config/logger';

export type MessageResult = 'sent' | 'not_connected' | 'captcha' | 'failed';

export async function sendDirectMessage(
  context: BrowserContext,
  profileUrl: string,
  message: string
): Promise<MessageResult> {
  const page = await context.newPage();
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await shortDelay(2000, 3000);
    await humanScroll(page);

    if (await detectCaptcha(page)) {
      logger.warn(`[Message] CAPTCHA on ${profileUrl}`);
      return 'captcha';
    }

    // Check if Message button is available (1st-degree connection)
    const messageBtn = page.locator('button:has-text("Message"), a:has-text("Message")').first();
    if (!await messageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      logger.info(`[Message] Not connected, can't message: ${profileUrl}`);
      return 'not_connected';
    }

    await messageBtn.click();
    await shortDelay(1500, 2500);

    // Type message in chat box
    const msgBox = page.locator('.msg-form__contenteditable, [role="textbox"][data-placeholder*="message"]').first();
    await msgBox.click();
    await shortDelay(500, 800);

    for (const char of message) {
      await page.keyboard.type(char, { delay: Math.random() * 100 + 30 });
    }

    await shortDelay(800, 1500);

    // Send message
    const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]:has-text("Send")').first();
    await sendBtn.click();
    await shortDelay(1500, 2500);

    logger.info(`[Message] Sent to: ${profileUrl}`);
    return 'sent';
  } catch (err) {
    logger.error(`[Message] Failed for ${profileUrl}:`, err);
    return 'failed';
  } finally {
    await page.close();
  }
}

/**
 * Personalise a template body with lead data.
 */
export function personaliseTemplate(
  template: string,
  data: { firstName?: string; lastName?: string; company?: string; headline?: string }
): string {
  return template
    .replace(/\{\{firstName\}\}/gi, data.firstName || 'there')
    .replace(/\{\{lastName\}\}/gi, data.lastName || '')
    .replace(/\{\{company\}\}/gi, data.company || 'your company')
    .replace(/\{\{headline\}\}/gi, data.headline || 'your profile');
}
