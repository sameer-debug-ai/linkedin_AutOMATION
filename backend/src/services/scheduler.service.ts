import { ActivityLog } from '../models/ActivityLog.model';
import { User } from '../models/User.model';
import { logger } from '../config/logger';
import { Types } from 'mongoose';

/**
 * Check how many actions have been taken today for a user.
 */
export async function getDailyUsage(userId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const used = await ActivityLog.countDocuments({
    userId: new Types.ObjectId(userId),
    action: { $in: ['connect_sent', 'message_sent'] },
    timestamp: { $gte: startOfDay },
  });

  const limit = user.dailyLimit ?? 25;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Check if automation is allowed to run right now:
 * - Within working hours (9am–6pm in user timezone)
 * - Daily limit not exceeded
 */
export async function canRunAutomation(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const usage = await getDailyUsage(userId);
  if (usage.remaining <= 0) {
    return { allowed: false, reason: `Daily limit of ${usage.limit} actions reached` };
  }

  // Working hours check (9am–6pm)
  const now = new Date();
  const hour = now.getHours();
  if (hour < 9 || hour >= 18) {
    return { allowed: false, reason: 'Outside working hours (9am–6pm). Automation paused.' };
  }

  return { allowed: true };
}

/**
 * Log that automation should stop due to limit enforcement.
 */
export async function enforceDailyLimit(userId: string, jobId: string): Promise<boolean> {
  const check = await canRunAutomation(userId);
  if (!check.allowed) {
    logger.warn(`[Scheduler] Job ${jobId} blocked: ${check.reason}`);
    return false;
  }
  return true;
}
