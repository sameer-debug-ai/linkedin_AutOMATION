import { Response, NextFunction } from 'express';
import CryptoJS from 'crypto-js';
import { AuthRequest } from '../middleware/auth.middleware';
import { createError } from '../middleware/error-handler';
import { AutomationJob } from '../models/AutomationJob.model';
import { ActivityLog } from '../models/ActivityLog.model';
import { User } from '../models/User.model';
import { automationQueue } from '../queue/automation.worker';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { createBrowserContext, closeBrowser } from '../automation/browser';
import { verifyLinkedInSession } from '../automation/linkedin-login';
import { syncLinkedInResponses } from '../automation/linkedin-sync';
import { Lead, calculateLeadScore } from '../models/Lead.model';
import { searchLinkedInPeople } from '../automation/linkedin-search';

export async function startJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { keywords, location, targetCount, templateId, actionType } = req.body;
    if (!keywords?.length || !location || !templateId) {
      next(createError('keywords, location, and templateId are required', 400)); return;
    }

    const job = await AutomationJob.create({
      userId: req.userId,
      status: 'pending',
      config: { keywords, location, targetCount: targetCount || 20, templateId, actionType: actionType || 'connect' },
      progress: { processed: 0, successful: 0, failed: 0, skipped: 0 },
    });

    const bullJob = await automationQueue.add('run', { jobId: String(job._id), userId: req.userId }, {
      removeOnComplete: 50,
      removeOnFail: 50,
    });

    await AutomationJob.findByIdAndUpdate(job._id, { bullJobId: String(bullJob.id) });
    res.status(201).json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function pauseJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await AutomationJob.findOneAndUpdate(
      { _id: req.params.jobId, userId: req.userId, status: 'running' },
      { status: 'paused' },
      { new: true }
    );
    if (!job) { next(createError('Running job not found', 404)); return; }
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function resumeJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const dbJob = await AutomationJob.findOne({ _id: req.params.jobId, userId: req.userId });
    if (!dbJob || dbJob.status !== 'paused') { next(createError('Paused job not found', 404)); return; }

    // Re-queue the job
    const bullJob = await automationQueue.add('run', { jobId: String(dbJob._id), userId: req.userId });
    await AutomationJob.findByIdAndUpdate(dbJob._id, { status: 'running', bullJobId: String(bullJob.id) });
    res.json({ success: true, message: 'Job resumed' });
  } catch (err) { next(err); }
}

export async function stopJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await AutomationJob.findOneAndUpdate(
      { _id: req.params.jobId, userId: req.userId },
      { status: 'cancelled', completedAt: new Date() },
      { new: true }
    );
    if (!job) { next(createError('Job not found', 404)); return; }
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function getJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobs = await AutomationJob.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50).populate('config.templateId', 'name');
    res.json({ success: true, data: jobs });
  } catch (err) { next(err); }
}

export async function getJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await AutomationJob.findOne({ _id: req.params.jobId, userId: req.userId }).populate('config.templateId', 'name');
    if (!job) { next(createError('Job not found', 404)); return; }
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
}

export async function getDailyUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [used, user] = await Promise.all([
      ActivityLog.countDocuments({ userId: req.userId, action: { $in: ['connect_sent', 'message_sent'] }, timestamp: { $gte: today } }),
      User.findById(req.userId),
    ]);
    res.json({ success: true, data: { used, limit: user?.dailyLimit || 25, remaining: Math.max(0, (user?.dailyLimit || 25) - used) } });
  } catch (err) { next(err); }
}

export async function syncResponses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let browser: any;
  try {
    const user = await User.findById(req.userId);
    if (!user) { next(createError('User not found', 404)); return; }

    let cookiesJsonStr: string | undefined;
    if (user.linkedinCookies) {
      try {
        const bytes = CryptoJS.AES.decrypt(user.linkedinCookies, env.encryptionKey);
        cookiesJsonStr = bytes.toString(CryptoJS.enc.Utf8);
      } catch (err) {
        logger.error('[Sync Controller] Failed to decrypt user cookies:', err);
      }
    }

    if (!cookiesJsonStr) {
      next(createError('No LinkedIn session cookies found. Please log in to LinkedIn first.', 400));
      return;
    }

    const contextResult = await createBrowserContext(cookiesJsonStr);
    browser = contextResult.browser;
    const context = contextResult.context;

    const sessionValid = await verifyLinkedInSession(context);
    if (!sessionValid) {
      next(createError('LinkedIn session expired or invalid. Please re-login on LinkedIn.', 401));
      return;
    }

    // Save updated session cookies back to DB
    const cookies = await context.cookies('https://www.linkedin.com');
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(cookies), env.encryptionKey).toString();
    await User.findByIdAndUpdate(user._id, { linkedinCookies: encrypted });

    const result = await syncLinkedInResponses(context, String(user._id));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  } finally {
    if (browser) {
      await closeBrowser(browser);
    }
  }
}

export async function startBulkJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { leadIds, templateId } = req.body;
    if (!leadIds?.length || !templateId) {
      next(createError('leadIds and templateId are required', 400)); return;
    }

    const job = await AutomationJob.create({
      userId: req.userId,
      status: 'pending',
      config: { keywords: ['bulk_outreach'], location: 'Direct Selection', targetCount: leadIds.length, templateId, actionType: 'connect' },
      progress: { processed: 0, successful: 0, failed: 0, skipped: 0 },
    });

    const bullJob = await automationQueue.add('run', { jobId: String(job._id), userId: req.userId, leadIds, templateId }, {
      removeOnComplete: 50,
      removeOnFail: 50,
    });

    await AutomationJob.findByIdAndUpdate(job._id, { bullJobId: String(bullJob.id) });
    res.status(201).json({ success: true, data: job, message: `Bulk outreach started for ${leadIds.length} leads!` });
  } catch (err) { next(err); }
}

export async function discoverClients(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let browser: any;
  try {
    const { keywords, location, targetCount } = req.body;
    if (!keywords?.length || !location) {
      next(createError('keywords and location are required', 400)); return;
    }

    const user = await User.findById(req.userId);
    if (!user) { next(createError('User not found', 404)); return; }

    let cookiesJsonStr: string | undefined;
    if (user.linkedinCookies) {
      try {
        const bytes = CryptoJS.AES.decrypt(user.linkedinCookies, env.encryptionKey);
        cookiesJsonStr = bytes.toString(CryptoJS.enc.Utf8);
      } catch (err) {
        logger.error('[Discover] Failed to decrypt user cookies:', err);
      }
    }

    if (!cookiesJsonStr) {
      next(createError('No LinkedIn session cookies found. Please log in first.', 400)); return;
    }

    const contextResult = await createBrowserContext(cookiesJsonStr);
    browser = contextResult.browser;
    const context = contextResult.context;

    const sessionValid = await verifyLinkedInSession(context);
    if (!sessionValid) {
      next(createError('LinkedIn session expired. Please re-login on LinkedIn.', 401)); return;
    }

    // Save updated session cookies
    const cookies = await context.cookies('https://www.linkedin.com');
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(cookies), env.encryptionKey).toString();
    await User.findByIdAndUpdate(user._id, { linkedinCookies: encrypted });

    const maxCount = targetCount || 20;
    const profiles = await searchLinkedInPeople(context, keywords, location, maxCount);

    const savedLeads = [];
    for (const p of profiles) {
      let lead = await Lead.findOne({ linkedinProfileUrl: p.profileUrl, userId: user._id });
      if (!lead) {
        const { leadScore, matchLevel } = calculateLeadScore(p.headline, p.company);
        lead = await Lead.create({
          userId: user._id,
          linkedinProfileUrl: p.profileUrl,
          name: p.name,
          headline: p.headline,
          company: p.company,
          location: p.location,
          connectionDegree: p.connectionDegree as any,
          status: 'discovered',
          leadScore,
          matchLevel,
        });
      }
      savedLeads.push(lead);
    }

    res.json({ success: true, count: savedLeads.length, data: savedLeads });
  } catch (err) {
    next(err);
  } finally {
    if (browser) {
      await closeBrowser(browser);
    }
  }
}
