import CryptoJS from 'crypto-js';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AutomationJob } from '../models/AutomationJob.model';
import { Lead } from '../models/Lead.model';
import { ActivityLog } from '../models/ActivityLog.model';
import { Template } from '../models/Template.model';
import { User } from '../models/User.model';
import { createBrowserContext, closeBrowser } from '../automation/browser';
import { verifyLinkedInSession } from '../automation/linkedin-login';
import { searchLinkedInPeople, normalizeUrl } from '../automation/linkedin-search';
import { sendConnectionRequest } from '../automation/linkedin-connect';
import { sendDirectMessage, personaliseTemplate } from '../automation/linkedin-message';
import { syncLinkedInResponses } from '../automation/linkedin-sync';
import { randomDelay } from '../automation/human-delay';
import { getSocketServer } from './socket';

export const redisConnection = new IORedis({
  host: env.redis.host,
  port: env.redis.port,
  maxRetriesPerRequest: null,
});

export const automationQueue = new Queue('automation', { connection: redisConnection });

export function createAutomationWorker(): Worker {
  const worker = new Worker(
    'automation',
    async (job: Job) => {
      const { jobId, userId } = job.data as { jobId: string; userId: string };
      const dbJob = await AutomationJob.findById(jobId).populate('config.templateId');
      if (!dbJob) throw new Error(`Job ${jobId} not found in DB`);

      const user = await User.findById(userId);
      if (!user) throw new Error(`User ${userId} not found`);

      const template = await Template.findById(dbJob.config.templateId);
      if (!template) throw new Error('Template not found');

      const io = getSocketServer();
      const emit = (event: string, data: unknown) => io?.to(`user:${userId}`).emit(event, data);

      await AutomationJob.findByIdAndUpdate(jobId, { status: 'running', startedAt: new Date() });
      emit('job:update', { jobId, status: 'running' });

      let cookiesJsonStr: string | undefined;
      if (user.linkedinCookies) {
        try {
          const bytes = CryptoJS.AES.decrypt(user.linkedinCookies, env.encryptionKey);
          cookiesJsonStr = bytes.toString(CryptoJS.enc.Utf8);
        } catch (err) {
          logger.error('[Worker] Failed to decrypt user cookies:', err);
        }
      }

      const { browser, context } = await createBrowserContext(cookiesJsonStr);
      try {
        // Verify session
        const sessionValid = await verifyLinkedInSession(context);
        if (!sessionValid) {
          await AutomationJob.findByIdAndUpdate(jobId, { status: 'failed', errorMessage: 'LinkedIn session invalid' });
          emit('job:update', { jobId, status: 'failed', error: 'LinkedIn session invalid — please re-login' });
          return;
        }

        // Save fresh cookies back to DB
        const cookies = await context.cookies('https://www.linkedin.com');
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(cookies), env.encryptionKey).toString();
        await User.findByIdAndUpdate(userId, { linkedinCookies: encrypted });

        await ActivityLog.create({ userId, jobId, action: 'job_started', details: `Job started: ${dbJob.config.keywords.join(', ')}` });

        // Check daily limit
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayActions = await ActivityLog.countDocuments({
          userId,
          action: { $in: ['connect_sent', 'message_sent'] },
          timestamp: { $gte: today },
        });

        const remaining = user.dailyLimit - todayActions;
        if (remaining <= 0) {
          await AutomationJob.findByIdAndUpdate(jobId, { status: 'completed', errorMessage: 'Daily limit reached' });
          emit('job:update', { jobId, status: 'completed', message: 'Daily limit already reached' });
          return;
        }

        const targetCount = Math.min(dbJob.config.targetCount, remaining);

        // Fetch already actioned leads to exclude them from search results
        const actionedLeads = await Lead.find({
          userId,
          status: { $in: ['request_sent', 'connected', 'messaged'] }
        }, 'linkedinProfileUrl');
        const excludeUrls = new Set(actionedLeads.map(l => normalizeUrl(l.linkedinProfileUrl)));

        // Search for leads
        emit('job:log', { message: `Searching for: ${dbJob.config.keywords.join(', ')} in ${dbJob.config.location}` });
        const profiles = await searchLinkedInPeople(
          context,
          dbJob.config.keywords,
          dbJob.config.location,
          targetCount,
          excludeUrls,
          async () => {
            emit('job:captcha', { jobId, message: 'CAPTCHA detected — automation paused. Please check the browser.' });
            await AutomationJob.findByIdAndUpdate(jobId, { status: 'paused' });
          }
        );

        emit('job:log', { message: `Found ${profiles.length} profiles. Starting outreach...` });

        // Shuffle profiles for less predictable pattern
        const shuffled = profiles.sort(() => Math.random() - 0.5);
        let processed = 0, successful = 0, failed = 0, skipped = 0;

        for (const profile of shuffled) {
          // Re-check daily limit each iteration
          const currentCount = await ActivityLog.countDocuments({
            userId,
            action: { $in: ['connect_sent', 'message_sent'] },
            timestamp: { $gte: today },
          });

          if (currentCount >= user.dailyLimit) {
            emit('job:log', { message: '⛔ Daily limit reached. Stopping.' });
            break;
          }

          // Check job hasn't been cancelled/paused
          const freshJob = await AutomationJob.findById(jobId);
          if (!freshJob || ['cancelled', 'paused', 'failed'].includes(freshJob.status)) {
            logger.info(`[Worker] Job ${jobId} was ${freshJob?.status} — stopping`);
            break;
          }

          try {
            // Save or find existing lead
            let lead = await Lead.findOne({ linkedinProfileUrl: profile.profileUrl });
            if (!lead) {
              lead = await Lead.create({
                userId,
                linkedinProfileUrl: profile.profileUrl,
                name: profile.name,
                headline: profile.headline,
                company: profile.company,
                location: profile.location,
                connectionDegree: profile.connectionDegree as '1st' | '2nd' | '3rd' | 'unknown',
                status: 'discovered',
              });
            }

            // Skip if already actioned
            if (['request_sent', 'connected', 'messaged'].includes(lead.status)) {
              skipped++;
              continue;
            }

            const firstName = profile.name.split(' ')[0];
            const personalised = personaliseTemplate(template.body, {
              firstName,
              company: profile.company,
              headline: profile.headline,
            });

            emit('job:log', { message: `Processing: ${profile.name} — ${profile.profileUrl}` });

            if (dbJob.config.actionType === 'connect' || dbJob.config.actionType === 'both') {
              if (profile.connectionDegree !== '1st') {
                const noteToSend = dbJob.config.actionType === 'connect' ? '' : personalised.slice(0, 200);
                const result = await sendConnectionRequest(context, profile.profileUrl, noteToSend);
                if (result === 'captcha') {
                  await AutomationJob.findByIdAndUpdate(jobId, { status: 'paused' });
                  emit('job:captcha', { jobId });
                  break;
                }
                if (result === 'sent') {
                  await lead.updateOne({ status: 'request_sent', templateUsed: template._id, messageSentAt: new Date() });
                  await ActivityLog.create({ userId, leadId: lead._id, jobId, action: 'connect_sent', details: `Sent to ${profile.name}` });
                  successful++;
                  emit('lead:updated', { leadId: lead._id, status: 'request_sent', name: profile.name });
                  emit('job:log', { message: `✅ Connection request sent to ${profile.name}` });
                } else if (result === 'already_connected') {
                  await lead.updateOne({ status: 'connected' });
                  await ActivityLog.create({ userId, leadId: lead._id, jobId, action: 'connected', details: `${profile.name} is connected` });
                  emit('lead:updated', { leadId: lead._id, status: 'connected', name: profile.name });
                  emit('job:log', { message: `🤝 ${profile.name} is already connected` });
                } else if (result === 'pending') {
                  await lead.updateOne({ status: 'request_sent' });
                  emit('lead:updated', { leadId: lead._id, status: 'request_sent', name: profile.name });
                }
              }
            }

            if (dbJob.config.actionType === 'message' || (dbJob.config.actionType === 'both' && profile.connectionDegree === '1st')) {
              if (profile.connectionDegree === '1st') {
                const result = await sendDirectMessage(context, profile.profileUrl, personalised);
                if (result === 'sent') {
                  await lead.updateOne({ status: 'messaged', templateUsed: template._id, messageSentAt: new Date() });
                  await ActivityLog.create({ userId, leadId: lead._id, jobId, action: 'message_sent', details: `Message sent to ${profile.name}` });
                  successful++;
                  emit('lead:updated', { leadId: lead._id, status: 'messaged', name: profile.name });
                  emit('job:log', { message: `✅ Message sent to ${profile.name}` });
                }
              }
            }

            processed++;
            await AutomationJob.findByIdAndUpdate(jobId, { 'progress.processed': processed, 'progress.successful': successful });
            emit('job:progress', { jobId, processed, successful, failed, skipped, total: shuffled.length });

            // Human-like delay between each action
            await randomDelay();
          } catch (err) {
            failed++;
            logger.error(`[Worker] Error processing ${profile.profileUrl}:`, err);
            await ActivityLog.create({ userId, jobId, action: 'error', details: `Error on ${profile.name}: ${String(err)}` });
          }
        }

        // Auto sync connection acceptances & message replies
        try {
          emit('job:log', { message: '🔄 Syncing accepted connections and replies...' });
          await syncLinkedInResponses(context, userId);
        } catch (syncErr) {
          logger.error('[Worker] Error running post-job sync:', syncErr);
        }

        await AutomationJob.findByIdAndUpdate(jobId, {
          status: 'completed',
          completedAt: new Date(),
          progress: { processed, successful, failed, skipped },
        });
        await ActivityLog.create({ userId, jobId, action: 'job_completed', details: `Job complete. ${successful} successful, ${failed} failed.` });
        emit('job:update', { jobId, status: 'completed', progress: { processed, successful, failed, skipped } });
      } finally {
        await closeBrowser(browser);
      }
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on('failed', async (job, err) => {
    logger.error(`[Worker] Job ${job?.id} failed:`, err);
    if (job?.data?.jobId) {
      await AutomationJob.findByIdAndUpdate(job.data.jobId, { status: 'failed', errorMessage: err.message });
    }
  });

  logger.info('[Queue] Automation worker started');
  return worker;
}
