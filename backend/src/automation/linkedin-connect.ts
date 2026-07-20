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
        await shortDelay(500, 1000);
        
        if (await detectCaptcha(page)) {
          logger.warn(`[Connect] CAPTCHA on ${profileUrl}`);
          return 'captcha';
        }

        // Check if we are on the invite page by checking presence of "Add a note" or "Send without a note"
        const addNoteBtn = page.locator('button:has-text("Add a note"), button:has-text("Send without a note")').first();
        if (await addNoteBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
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
      await shortDelay(500, 1000);
      await humanScroll(page);

      if (await detectCaptcha(page)) {
        logger.warn(`[Connect] CAPTCHA on ${profileUrl}`);
        return 'captcha';
      }

      // Check if already connected (Message button visible)
      const messageBtn = page.locator('button:has-text("Message"), a:has-text("Message")').first();
      if (await messageBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        logger.info(`[Connect] Already connected: ${profileUrl}`);
        return 'already_connected';
      }

      // Check for pending request
      const pendingBtn = page.locator('button:has-text("Pending")').first();
      if (await pendingBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        logger.info(`[Connect] Request already pending: ${profileUrl}`);
        return 'pending';
      }

      // Try direct Connect button or link
      let connectBtn = page.locator('a[href*="/preload/custom-invite/"], button:has-text("Connect")').first();
      let connectVisible = await connectBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (!connectVisible) {
        // Try "More" actions dropdown
        const moreBtn = page.locator('button[aria-label="More actions"]').first();
        if (await moreBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await moreBtn.click();
          await shortDelay(300, 600);
          connectBtn = page.locator('[role="menuitem"]:has-text("Connect"), button:has-text("Connect")').first();
          connectVisible = await connectBtn.isVisible({ timeout: 1500 }).catch(() => false);
        }
      }

      if (!connectVisible) {
        logger.warn(`[Connect] No connect button found: ${profileUrl}`);
        return 'not_available';
      }

      await connectBtn.click();
      await shortDelay(400, 800);
    }

    // Add personalised note
    const addNoteBtn = page.locator('button:has-text("Add a note")').first();
    if (note && await addNoteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addNoteBtn.click();
      await shortDelay(400, 800);

      const textareaSelector = 'div[role="dialog"] textarea, textarea#custom-message, textarea[name="message"], textarea[id*="custom-message"]';
      const textarea = page.locator(textareaSelector).first();
      await textarea.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
      
      await textarea.click().catch(() => {});
      await shortDelay(150, 300);
      await textarea.fill('');
      
      await humanType(page, textareaSelector, note.slice(0, 200));
      await shortDelay(400, 800);
    }

    // Click Send (prioritize non-disabled primary buttons or Send without a note)
    let sendBtn = page.locator('button:has-text("Send without a note"), button.artdeco-button--primary:not([disabled]):not(.artdeco-button--disabled), button[aria-label="Send invitation"]:not([disabled])').first();
    let isSendVisible = await sendBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isSendVisible) {
      sendBtn = page.locator('button:has-text("Send"), button[aria-label="Send invitation"]').first();
    }
    await sendBtn.click();
    await shortDelay(800, 1500);

    logger.info(`[Connect] Request sent to: ${profileUrl}`);
    return 'sent';
  } catch (err) {
    logger.error(`[Connect] Failed for ${profileUrl}:`, err);
    return 'failed';
  } finally {
    await page.close();
  }
}
