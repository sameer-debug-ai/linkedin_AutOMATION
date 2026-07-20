import nodemailer from 'nodemailer';
import { logger } from '../config/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export function createTransporter() {
  const host = process.env['SMTP_HOST'] || 'smtp.gmail.com';
  const port = parseInt(process.env['SMTP_PORT'] || '587', 10);
  const user = process.env['SMTP_USER'] || 'sameerkhan87512@gmail.com';
  const pass = process.env['SMTP_PASS'] || '';

  if (pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // Fallback to direct stream transporter for dev logging
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const fromAddress = process.env['SMTP_USER'] || 'sameerkhan87512@gmail.com';

    const info = await transporter.sendMail({
      from: `"Sameer Khan" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text?.replace(/\n/g, '<br>'),
    });

    logger.info(`[EmailService] Sent email to ${options.to}: ${info.messageId || 'OK'}`);
    return true;
  } catch (err) {
    logger.error(`[EmailService] Failed to send email to ${options.to}:`, err);
    return false;
  }
}
