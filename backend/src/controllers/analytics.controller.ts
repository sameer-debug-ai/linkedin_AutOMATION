import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Lead } from '../models/Lead.model';
import { ActivityLog } from '../models/ActivityLog.model';

export async function getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [totalLeads, statusCounts, todaySent, totalReplied, logs] = await Promise.all([
      Lead.countDocuments({ userId }),
      Lead.aggregate([
        { $match: { userId: { $eq: require('mongoose').Types.ObjectId.createFromHexString(userId!) } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      ActivityLog.countDocuments({ userId, action: { $in: ['connect_sent', 'message_sent'] }, timestamp: { $gte: today } }),
      Lead.countDocuments({ userId, status: 'replied' }),
      ActivityLog.find({ userId }).sort({ timestamp: -1 }).limit(10).populate('leadId', 'name profileUrl'),
    ]);

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: { _id: string; count: number }) => { statusMap[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        totalLeads,
        todaySent,
        totalReplied,
        conversionRate: totalLeads > 0 ? ((totalReplied / totalLeads) * 100).toFixed(1) : '0',
        byStatus: statusMap,
        recentActivity: logs,
      },
    });
  } catch (err) { next(err); }
}

export async function getDailyTrend(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trend = await ActivityLog.aggregate([
      {
        $match: {
          userId: require('mongoose').Types.ObjectId.createFromHexString(req.userId!),
          action: { $in: ['connect_sent', 'message_sent'] },
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    res.json({ success: true, data: trend });
  } catch (err) { next(err); }
}

export async function getConversionByTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await Lead.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(req.userId!), templateUsed: { $exists: true } } },
      { $group: { _id: '$templateUsed', total: { $sum: 1 }, replied: { $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] } } } },
      { $lookup: { from: 'templates', localField: '_id', foreignField: '_id', as: 'template' } },
      { $unwind: '$template' },
      { $project: { templateName: '$template.name', total: 1, replied: 1, rate: { $multiply: [{ $divide: ['$replied', '$total'] }, 100] } } },
    ]);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const filter: Record<string, unknown> = { userId: req.userId };
    if (action) filter.action = action;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(Number(limit)).populate('leadId', 'name'),
      ActivityLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}
