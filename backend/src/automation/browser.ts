import { chromium, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';

const COOKIES_PATH = path.resolve(__dirname, '../../data/linkedin-cookies.json');

function sanitizePlaywrightCookies(cookies: any[]): any[] {
  return cookies.map((c) => {
    const clean: any = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
    };

    if (c.sameSite) {
      const ss = String(c.sameSite).toLowerCase();
      if (ss === 'strict') clean.sameSite = 'Strict';
      else if (ss === 'lax') clean.sameSite = 'Lax';
      else if (ss === 'none' || ss === 'no_restriction') clean.sameSite = 'None';
    }

    if (c.expires !== undefined) {
      clean.expires = Math.floor(Number(c.expires));
    } else if (c.expirationDate !== undefined) {
      clean.expires = Math.floor(Number(c.expirationDate));
    }

    return clean;
  });
}

export async function createBrowserContext(cookiesJsonStr?: string, forceHeadless?: boolean): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: forceHeadless !== undefined ? forceHeadless : env.playwright.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Mask WebDriver detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Restore saved cookies
  if (cookiesJsonStr) {
    try {
      let cookies = JSON.parse(cookiesJsonStr);
      if (Array.isArray(cookies)) {
        cookies = sanitizePlaywrightCookies(cookies);
      }
      await context.addCookies(cookies);
      logger.info('[Browser] Session cookies loaded from user account successfully');
    } catch (err) {
      logger.warn('[Browser] Failed to load cookies from user account:', err);
    }
  } else if (fs.existsSync(COOKIES_PATH)) {
    try {
      let rawCookies = fs.readFileSync(COOKIES_PATH, 'utf-8');
      let cookies = JSON.parse(rawCookies);
      if (Array.isArray(cookies)) {
        cookies = sanitizePlaywrightCookies(cookies);
      }
      await context.addCookies(cookies);
      logger.info('[Browser] Session cookies loaded from local file successfully');
    } catch (err) {
      logger.warn('[Browser] Failed to load cookies from local file:', err);
    }
  }

  return { browser, context };
}

export async function saveCookies(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies('https://www.linkedin.com');
  fs.mkdirSync(path.dirname(COOKIES_PATH), { recursive: true });
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  logger.info('[Browser] LinkedIn cookies saved');
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
  logger.info('[Browser] Browser closed');
}
