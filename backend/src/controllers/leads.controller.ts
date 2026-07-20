import { Response, NextFunction } from 'express';
import { Lead, calculateLeadScore } from '../models/Lead.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { createError } from '../middleware/error-handler';

export async function getLeads(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, matchLevel, page = 1, limit = 20, search } = req.query;
    const filter: Record<string, unknown> = { userId: req.userId };
    if (status) filter.status = status;
    if (matchLevel) filter.matchLevel = matchLevel;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { headline: { $regex: search, $options: 'i' } },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    let [leads, total] = await Promise.all([
      Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('templateUsed', 'name'),
      Lead.countDocuments(filter),
    ]);

    // Backfill leadScore & matchLevel for any legacy leads missing them
    for (const lead of leads) {
      if (!lead.leadScore || !lead.matchLevel) {
        const scoreData = calculateLeadScore(lead.headline, lead.company);
        lead.leadScore = scoreData.leadScore;
        lead.matchLevel = scoreData.matchLevel;
        await lead.save();
      }
    }

    res.json({ success: true, data: leads, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

export async function getLead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.userId });
    if (!lead) { next(createError('Lead not found', 404)); return; }
    res.json({ success: true, data: lead });
  } catch (err) { next(err); }
}

export async function updateLeadStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body;
    const valid = ['discovered', 'request_sent', 'connected', 'messaged', 'replied', 'ignored'];
    if (!valid.includes(status)) { next(createError('Invalid status', 400)); return; }

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status },
      { new: true }
    );
    if (!lead) { next(createError('Lead not found', 404)); return; }
    res.json({ success: true, data: lead });
  } catch (err) { next(err); }
}

export async function generateAiPitch(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.userId });
    if (!lead) { next(createError('Lead not found', 404)); return; }

    const firstName = lead.name.split(' ')[0] || 'there';
    const companyName = lead.company || 'your company';
    const roleTitle = lead.headline ? lead.headline.split('at')[0].trim() : 'leader';

    const pitches = [
      {
        title: '🎯 High-Impact Developer Outreach',
        note: `Hi ${firstName}, noticed your work as ${roleTitle} at ${companyName}. I build high-performing web apps. If you ever need extra developer bandwidth on overflow projects, I'd love to help out. Let's connect!`,
      },
      {
        title: '🤝 B2B Growth & Service Hook',
        note: `Hi ${firstName}, impressed by the work at ${companyName}! We help growing businesses scale tech & operations smoothly. Would love to connect and share a few ideas for your team.`,
      },
      {
        title: '⚡ Soft Conversational Opener',
        note: `Hi ${firstName}, came across your profile while looking at leaders in ${companyName}. Really liked your focus on ${roleTitle}. Would be great to connect and stay in touch!`,
      },
    ];

    res.json({ success: true, data: { lead, pitches } });
  } catch (err) { next(err); }
}

export async function deleteLead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!lead) { next(createError('Lead not found', 404)); return; }
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) { next(err); }
}

export async function exportLeadsCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const leads = await Lead.find({ userId: req.userId }).lean();
    const headers = ['Name', 'Headline', 'Company', 'Location', 'Status', 'Match Score', 'Match Level', 'Profile URL', 'Created At'];
    const rows = leads.map((l) => [
      l.name, l.headline, l.company, l.location, l.status, l.leadScore || 50, l.matchLevel || 'medium',
      l.linkedinProfileUrl, new Date(l.createdAt).toISOString(),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="linkedin-leads.csv"');
    res.send(csv);
  } catch (err) { next(err); }
}
