import { BrowserContext } from 'playwright';
import { shortDelay, humanType, humanScroll } from './human-delay';
import { detectCaptcha } from './linkedin-login';
import { logger } from '../config/logger';

export type ConnectResult = 'sent' | 'already_connected' | 'pending' | 'not_available' | 'captcha' | 'failed';

export async function sendConnectionRequest(
  context: BrowserContext,
  profileUrl: string,
  note: string
): Promise<ConnectResult> {
  const page = await context.newPage();
  try {
    if (await detectCaptcha(page)) {
      logger.warn(`[Connect] CAPTCHA detected initially — stopping`);
      return 'captcha';
    }

    // Primary flow: navigate directly to vanity invite page
    let isInvitePageLoaded = false;
    const vanityMatch = profileUrl.match(/\/in\/([^\/\?#]+)/);
    if (vanityMatch && vanityMatch[1]) {
      const vanityName = vanityMatch[1];
      const inviteUrl = `https://www.linkedin.com/preload/custom-invite/?vanityName=${vanityName}`;
      try {
        logger.info(`[Connect] Navigating directly to invite page for ${vanityName}`);
        await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await shortDelay(2000, 4000);
        
        if (await detectCaptcha(page)) {
          logger.warn(`[Connect] CAPTCHA on ${profileUrl}`);
          return 'captcha';
        }

        // Check if we are on the invite page by checking presence of "Add a note" or "Send without a note"
        const addNoteBtn = page.locator('button:has-text("Add a note"), button:has-text("Send without a note")').first();
        if (await addNoteBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
          isInvitePageLoaded = true;
        }
      } catch (e) {
        logger.warn(`[Connect] Direct invite page navigation failed: ${e}`);
      }
    }

    if (!isInvitePageLoaded) {
      // Fallback flow: navigate to profile page and click Connect
      logger.info(`[Connect] Falling back to profile page navigation: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await shortDelay(2000, 3500);
      await humanScroll(page);

      if (await detectCaptcha(page)) {
        logger.warn(`[Connect] CAPTCHA on ${profileUrl}`);
        return 'captcha';
      }

      // Check if already connected (Message button visible)
      const messageBtn = page.locator('button:has-text("Message"), a:has-text("Message")').first();
      if (await messageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        logger.info(`[Connect] Already connected: ${profileUrl}`);
        return 'already_connected';
      }

      // Check for pending request
      const pendingBtn = page.locator('button:has-text("Pending")').first();
      if (await pendingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        logger.info(`[Connect] Request already pending: ${profileUrl}`);
        return 'pending';
      }

      // Try direct Connect button or link
      let connectBtn = page.locator('a[href*="/preload/custom-invite/"], button:has-text("Connect")').first();
      let connectVisible = await connectBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (!connectVisible) {
        // Try "More" actions dropdown
        const moreBtn = page.locator('button[aria-label="More actions"]').first();
        if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await moreBtn.click();
          await shortDelay(600, 1200);
          connectBtn = page.locator('[role="menuitem"]:has-text("Connect"), button:has-text("Connect")').first();
          connectVisible = await connectBtn.isVisible({ timeout: 2000 }).catch(() => false);
        }
      }

      if (!connectVisible) {
        logger.warn(`[Connect] No connect button found: ${profileUrl}`);
        return 'not_available';
      }

      await connectBtn.click();
      await shortDelay(1500, 2500);
    }

    // Add personalised note
    const addNoteBtn = page.locator('button:has-text("Add a note")').first();
    if (note && await addNoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addNoteBtn.click();
      await shortDelay(800, 1500);

      const textareaSelector = 'textarea[name="message"], textarea#custom-message, textarea:not([name*="recaptcha"]):not([class*="recaptcha"]):not([id*="recaptcha"])';
      const textarea = page.locator(textareaSelector).first();
      await textarea.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      
      await textarea.click();
      await shortDelay(300, 600);
      await textarea.fill('');
      
      await humanType(page, textareaSelector, note.slice(0, 200));
      await shortDelay(800, 1500);
    }

    // Click Send
    const sendBtn = page.locator('button:has-text("Send"), button[aria-label="Send invitation"], button:has-text("Send without a note")').first();
    await sendBtn.click();
    await shortDelay(2000, 3000);

    logger.info(`[Connect] Request sent to: ${profileUrl}`);
    return 'sent';
  } catch (err) {
    logger.error(`[Connect] Failed for ${profileUrl}:`, err);
    return 'failed';
  } finally {
    await page.close();
  }
}
