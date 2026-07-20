import { Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { createError } from '../middleware/error-handler';

export async function getLeads(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const filter: Record<string, unknown> = { userId: req.userId };
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { headline: { $regex: search, $options: 'i' } },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [leads, total] = await Promise.all([
      Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('templateUsed', 'name'),
      Lead.countDocuments(filter),
    ]);

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
    const headers = ['Name', 'Headline', 'Company', 'Location', 'Status', 'Profile URL', 'Created At'];
    const rows = leads.map((l) => [
      l.name, l.headline, l.company, l.location, l.status,
      l.linkedinProfileUrl, new Date(l.createdAt).toISOString(),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  } catch (err) { next(err); }
}
