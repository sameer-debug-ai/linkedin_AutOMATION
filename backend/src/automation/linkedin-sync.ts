import { BrowserContext } from 'playwright';
import { Lead } from '../models/Lead.model';
import { ActivityLog } from '../models/ActivityLog.model';
import { logger } from '../config/logger';
import { shortDelay, humanScroll } from './human-delay';
import { normalizeUrl } from './linkedin-search';
import { getSocketServer } from '../queue/socket';

export interface SyncResult {
  connectedUpdated: number;
  repliedUpdated: number;
}

/**
 * Sync LinkedIn connections and incoming messages to update lead statuses automatically.
 */
export async function syncLinkedInResponses(
  context: BrowserContext,
  userId: string
): Promise<SyncResult> {
  const page = await context.newPage();
  let connectedUpdated = 0;
  let repliedUpdated = 0;
  const io = getSocketServer();
  const emit = (event: string, data: unknown) => io?.to(`user:${userId}`).emit(event, data);

  try {
    // 1. Check My Connections page for newly accepted connections
    logger.info(`[Sync] Checking recent connections for user ${userId}...`);
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await shortDelay(2000, 4000);
    await humanScroll(page);

    const connectionUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      return anchors
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => href.includes('/in/'));
    });

    const normalizedConnections = new Set(connectionUrls.map(u => normalizeUrl(u)));

    // Find leads waiting for connection acceptance
    const pendingLeads = await Lead.find({
      userId,
      status: 'request_sent',
    });

    for (const lead of pendingLeads) {
      const normUrl = normalizeUrl(lead.linkedinProfileUrl);
      if (normalizedConnections.has(normUrl)) {
        lead.status = 'connected';
        await lead.save();
        connectedUpdated++;
        await ActivityLog.create({
          userId,
          leadId: lead._id,
          action: 'connected',
          details: `${lead.name} accepted your connection request!`,
        });
        emit('lead:updated', { leadId: lead._id, status: 'connected', name: lead.name });
        logger.info(`[Sync] Lead ${lead.name} is now connected!`);
      }
    }

    // 2. Check LinkedIn Messaging for replies
    logger.info(`[Sync] Checking messages for user ${userId}...`);
    await page.goto('https://www.linkedin.com/messaging/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await shortDelay(2500, 4000);

    const messagingProfiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.msg-conversation-listitem a[href*="/in/"], .msg-thread a[href*="/in/"]'));
      const textNodes = Array.from(document.querySelectorAll('.msg-conversation-card__participant-names, .msg-conversation-listitem__participant-names'));
      
      const urls = links.map(l => (l as HTMLAnchorElement).href);
      const names = textNodes.map(t => t.textContent?.trim()).filter(Boolean);
      
      return { urls, names };
    });

    const normalizedMessagingUrls = new Set(messagingProfiles.urls.map(u => normalizeUrl(u)));
    const messagingNames = new Set((messagingProfiles.names as string[]).map(n => n.toLowerCase()));

    // Find leads that were messaged or request sent
    const messagedLeads = await Lead.find({
      userId,
      status: { $in: ['messaged', 'request_sent', 'connected'] },
    });

    for (const lead of messagedLeads) {
      const normUrl = normalizeUrl(lead.linkedinProfileUrl);
      const leadNameLower = lead.name.toLowerCase();

      if (normalizedMessagingUrls.has(normUrl) || messagingNames.has(leadNameLower)) {
        if (lead.status !== 'replied') {
          lead.status = 'replied';
          lead.repliedAt = new Date();
          await lead.save();
          repliedUpdated++;
          await ActivityLog.create({
            userId,
            leadId: lead._id,
            action: 'replied',
            details: `${lead.name} replied to your outreach!`,
          });
          emit('lead:updated', { leadId: lead._id, status: 'replied', name: lead.name });
          logger.info(`[Sync] Lead ${lead.name} replied!`);
        }
      }
    }

    logger.info(`[Sync] Complete for user ${userId}: ${connectedUpdated} newly connected, ${repliedUpdated} newly replied.`);
    return { connectedUpdated, repliedUpdated };
  } catch (err) {
    logger.error(`[Sync] Error syncing responses for user ${userId}:`, err);
    return { connectedUpdated, repliedUpdated };
  } finally {
    await page.close();
  }
}
