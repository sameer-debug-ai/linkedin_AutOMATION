import { createBrowserContext } from '../automation/browser';
import { verifyLinkedInSession } from '../automation/linkedin-login';
import { searchLinkedInPeople, LeadProfile } from '../automation/linkedin-search';
import { sendConnectionRequest } from '../automation/linkedin-connect';
import { sendDirectMessage } from '../automation/linkedin-message';
import { randomDelay } from '../automation/human-delay';
import { Lead } from '../models/Lead.model';
import { ActivityLog } from '../models/ActivityLog.model';
import { logger } from '../config/logger';
import { Types } from 'mongoose';

interface JobConfig {
  keywords: string[];
  location: string;
  targetCount: number;
  templateId: string;
  templateBody: string;
  actionType: 'connect' | 'message' | 'both';
  dailyLimit: number;
}

export async function runAutomationJob(
  userId: string,
  jobId: string,
  config: JobConfig,
  onProgress: (update: object) => void
): Promise<{ processed: number; successful: number; failed: number }> {
  const stats = { processed: 0, successful: 0, failed: 0 };

  const { browser, context } = await createBrowserContext();
  try {
    // Verify LinkedIn session
    const isLoggedIn = await verifyLinkedInSession(context);
    if (!isLoggedIn) {
      throw new Error('LinkedIn session expired. Please re-authenticate via the settings page.');
    }

    // Search for leads
    logger.info(`[AutomationService] Searching: "${config.keywords.join(', ')}" in "${config.location}"`);
    const profiles: LeadProfile[] = await searchLinkedInPeople(context, config.keywords, config.location, config.targetCount);

    onProgress({ stage: 'searching', found: profiles.length });

    // Process each lead
    for (const profile of profiles) {
      if (stats.processed >= config.dailyLimit) {
        logger.warn('[AutomationService] Daily limit reached, stopping.');
        break;
      }

      // Check if lead already exists
      const existing = await Lead.findOne({ linkedinProfileUrl: profile.profileUrl, userId });
      if (existing) {
        logger.info(`[AutomationService] Skipping duplicate: ${profile.name}`);
        continue;
      }

      // Upsert lead
      const lead = await Lead.create({
        userId: new Types.ObjectId(userId),
        linkedinProfileUrl: profile.profileUrl,
        name: profile.name,
        headline: profile.headline,
        company: profile.company,
        location: profile.location,
        connectionDegree: profile.connectionDegree as '1st' | '2nd' | '3rd',
        status: 'discovered',
      });

      stats.processed++;

      try {
        // Personalize message
        const message = config.templateBody
          .replace(/{{firstName}}/g, profile.name.split(' ')[0])
          .replace(/{{company}}/g, profile.company || 'your company')
          .replace(/{{headline}}/g, profile.headline || '');

        let actionResult: string;

        if (config.actionType === 'connect' || config.actionType === 'both') {
          const noteToSend = config.actionType === 'connect' ? '' : message.slice(0, 200);
          actionResult = await sendConnectionRequest(context, profile.profileUrl, noteToSend);
          if (actionResult === 'sent') {
            lead.status = 'request_sent';
            lead.templateUsed = new Types.ObjectId(config.templateId);
            await lead.save();

            await ActivityLog.create({
              userId: new Types.ObjectId(userId),
              leadId: lead._id,
              action: 'connect_sent',
              details: `Connection request sent to ${profile.name}`,
              jobId,
            });
            stats.successful++;
          }
        }

        if (config.actionType === 'message' || config.actionType === 'both') {
          await sendDirectMessage(context, profile.profileUrl, message);
          lead.status = 'messaged';
          lead.messageSentAt = new Date();
          await lead.save();

          await ActivityLog.create({
            userId: new Types.ObjectId(userId),
            leadId: lead._id,
            action: 'message_sent',
            details: `Message sent to ${profile.name}`,
            jobId,
          });
          stats.successful++;
        }

        onProgress({ stage: 'processing', lead: profile.name, stats });
      } catch (err) {
        stats.failed++;
        logger.error(`[AutomationService] Failed on ${profile.name}:`, err);
        await ActivityLog.create({
          userId: new Types.ObjectId(userId),
          leadId: lead._id,
          action: 'error',
          details: `Error processing ${profile.name}: ${(err as Error).message}`,
          jobId,
        });
      }

      // Human-like delay between actions
      await randomDelay(30000, 90000);
    }
  } finally {
    await browser.close();
  }

  return stats;
}
