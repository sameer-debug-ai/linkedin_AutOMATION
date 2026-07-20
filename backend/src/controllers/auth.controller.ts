import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { User } from '../models/User.model';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { createError } from '../middleware/error-handler';
import { createBrowserContext } from '../automation/browser';
import { verifyLinkedInSession, manualLogin } from '../automation/linkedin-login';

function signToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, timezone } = req.body;
    if (!email || !password) { next(createError('Email and password required', 400)); return; }

    const existing = await User.findOne({ email });
    if (existing) { next(createError('Email already registered', 409)); return; }

    const user = await User.create({ email, passwordHash: password, timezone: timezone || 'Asia/Kolkata' });
    const token = signToken(String(user._id));
    res.status(201).json({ success: true, token, user });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      next(createError('Invalid email or password', 401)); return;
    }
    const token = signToken(String(user._id));
    res.json({ success: true, token, user });
  } catch (err) { next(err); }
}

export async function saveLinkedInSession(req: Request & { userId?: string }, res: Response, next: NextFunction): Promise<void> {
  try {
    let { cookies } = req.body;
    if (!cookies) { next(createError('Cookies required', 400)); return; }

    // If it's a plain string (just the li_at value), construct the cookies array
    if (typeof cookies === 'string') {
      const cleanVal = cookies.trim().replace(/^"|"$/g, ''); // Remove surrounding quotes
      cookies = [
        {
          name: 'li_at',
          value: cleanVal,
          domain: '.linkedin.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None'
        }
      ];
    }

    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(cookies), env.encryptionKey).toString();
    await User.findByIdAndUpdate(req.userId, { linkedinCookies: encrypted });
    res.json({ success: true, message: 'LinkedIn session saved' });
  } catch (err) { next(err); }
}

export async function checkSessionStatus(req: Request & { userId?: string }, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.userId);
    if (!user?.linkedinCookies) {
      res.json({ success: true, sessionValid: false, reason: 'no_cookies' });
      return;
    }

    const bytes = CryptoJS.AES.decrypt(user.linkedinCookies, env.encryptionKey);
    const cookiesJsonStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!cookiesJsonStr) {
      res.json({ success: true, sessionValid: false, reason: 'decrypt_failed' });
      return;
    }

    const cookies: Array<{ name: string; value: string; expirationDate?: number }> = JSON.parse(cookiesJsonStr);

    // li_at is the primary LinkedIn session cookie — must exist
    const liAtCookie = cookies.find(c => c.name === 'li_at');
    if (!liAtCookie?.value) {
      res.json({ success: true, sessionValid: false, reason: 'missing_li_at' });
      return;
    }

    // Check if li_at has expired (expirationDate is Unix timestamp in seconds)
    if (liAtCookie.expirationDate) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (liAtCookie.expirationDate < nowSeconds) {
        logger.warn(`[SessionCheck] li_at cookie expired at ${new Date(liAtCookie.expirationDate * 1000).toISOString()}`);
        res.json({ success: true, sessionValid: false, reason: 'cookie_expired' });
        return;
      }
    }

    // JSESSIONID is also expected for authenticated sessions
    const hasJsession = cookies.some(c => c.name === 'JSESSIONID');
    if (!hasJsession) {
      logger.warn('[SessionCheck] JSESSIONID missing from cookies');
    }

    logger.info(`[SessionCheck] li_at present ✅, expires: ${liAtCookie.expirationDate ? new Date(liAtCookie.expirationDate * 1000).toISOString() : 'unknown'}, jsession: ${hasJsession}`);
    // Cookies look valid locally — actual LinkedIn access verified when automation runs
    res.json({ success: true, sessionValid: true, reason: 'connected' });
  } catch (err) { next(err); }
}


export async function triggerManualLogin(req: Request & { userId?: string }, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const { browser, context } = await createBrowserContext();
    const success = await manualLogin(context, email, password);
    await browser.close();
    if (!success) { next(createError('Login failed — check credentials or complete 2FA', 400)); return; }
    res.json({ success: true, message: 'LinkedIn login successful, cookies saved' });
  } catch (err) { next(err); }
}
