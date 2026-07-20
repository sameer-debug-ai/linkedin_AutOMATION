import crypto from 'crypto';
import { User } from '../models/User.model';
import { Types } from 'mongoose';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = Buffer.from(
  (process.env.COOKIE_ENCRYPTION_KEY || 'linkedin-automation-32-char-secret!').padEnd(32).slice(0, 32)
);

/**
 * Encrypt a plaintext string using AES-256-GCM.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const encrypted = buf.subarray(32);
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Save LinkedIn cookies (encrypted) to user document.
 */
export async function saveLinkedInCookies(userId: string, cookies: object[]): Promise<void> {
  const encrypted = encrypt(JSON.stringify(cookies));
  await User.findByIdAndUpdate(new Types.ObjectId(userId), { linkedinCookies: encrypted });
}

/**
 * Load and decrypt LinkedIn cookies for a user.
 */
export async function loadLinkedInCookies(userId: string): Promise<object[] | null> {
  const user = await User.findById(userId);
  if (!user?.linkedinCookies) return null;
  try {
    return JSON.parse(decrypt(user.linkedinCookies));
  } catch {
    return null;
  }
}
