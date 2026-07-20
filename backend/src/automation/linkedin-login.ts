import { BrowserContext, Page } from 'playwright';
import { saveCookies } from './browser';
import { humanType, shortDelay } from './human-delay';
import { logger } from '../config/logger';

export async function verifyLinkedInSession(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await shortDelay(2000, 4000);

    // Check if redirected to login
    const currentUrl = page.url();
    logger.info(`[Auth] Current page URL: ${currentUrl}`);

    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
      logger.warn(`[Auth] Session invalid — redirected to login/checkpoint/challenge: ${currentUrl}`);
      try {
        await page.screenshot({ path: 'data/debug-session.png', fullPage: true });
        logger.info('[Auth] Saved failure screenshot to backend/data/debug-session.png');
      } catch (screenshotErr) {
        logger.error('[Auth] Failed to save failure screenshot:', screenshotErr);
      }
      return false;
    }

    // Check for CAPTCHA
    const captcha = await page.locator('[id*="captcha"], [class*="captcha"]').count();
    if (captcha > 0) {
      logger.warn('[Auth] CAPTCHA detected during session verification');
      try {
        await page.screenshot({ path: 'data/debug-session.png', fullPage: true });
      } catch (e) {}
      return false;
    }

    // Verify a logged-in element exists using multiple robust selectors
    // Check for nav items visible in the screenshot (Home, My Network, Jobs, Messaging, Notifications, Me)
    const meNav = await page.locator('a[href*="/in/"], nav a[href*="feed"], .global-nav__primary-items').isVisible({ timeout: 8000 }).catch(() => false);
    const startPost = await page.locator('text=Start a post').isVisible({ timeout: 5000 }).catch(() => false);
    const profilePic = await page.locator('.feed-identity-module__actor-meta, .profile-photo-edit__preview, .presence-entity__image').isVisible({ timeout: 5000 }).catch(() => false);
    const notifIcon = await page.locator('a[href*="notifications"]').isVisible({ timeout: 5000 }).catch(() => false);
    const msgIcon  = await page.locator('a[href*="messaging"]').isVisible({ timeout: 5000 }).catch(() => false);
    
    logger.info(`[Auth] Element check: meNav=${meNav}, startPost=${startPost}, profilePic=${profilePic}, notif=${notifIcon}, msg=${msgIcon}`);

    if (meNav || startPost || profilePic || notifIcon || msgIcon) {
      await saveCookies(context);
      logger.info('[Auth] LinkedIn session is valid');
      return true;
    }

    logger.warn('[Auth] LinkedIn session appears invalid (elements not visible)');
    try {
      await page.screenshot({ path: 'data/debug-session.png', fullPage: true });
      logger.info('[Auth] Saved failure screenshot to backend/data/debug-session.png');
    } catch (screenshotErr) {}
    return false;
  } catch (err) {
    logger.error('[Auth] Error verifying session:', err);
    return false;
  } finally {
    await page.close();
  }
}

export async function manualLogin(context: BrowserContext, email: string, password: string): Promise<boolean> {
  const page: Page = await context.newPage();
  try {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });
    await shortDelay(1500, 2500);

    await humanType(page, '#username', email);
    await shortDelay(500, 1000);
    await humanType(page, '#password', password);
    await shortDelay(700, 1200);

    await page.click('[type="submit"]');
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 30000 });

    const currentUrl = page.url();
    if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
      logger.warn('[Auth] LinkedIn requires 2FA or security challenge — user action needed');
      // Keep browser open for manual completion
      await page.waitForURL('**/feed/**', { timeout: 120000 });
    }

    await saveCookies(context);
    logger.info('[Auth] Manual login successful');
    return true;
  } catch (err) {
    logger.error('[Auth] Login failed:', err);
    return false;
  } finally {
    await page.close();
  }
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    '[id*="captcha"]',
    '[class*="captcha"]',
    'text=Let\'s do a quick security check',
    'text=security verification',
  ];

  for (const selector of captchaSelectors) {
    const visible = await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) return true;
  }
  return false;
}
