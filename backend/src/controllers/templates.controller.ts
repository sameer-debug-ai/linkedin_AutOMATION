import { Response, NextFunction } from 'express';
import { Template } from '../models/Template.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { createError } from '../middleware/error-handler';
import { personaliseTemplate } from '../automation/linkedin-message';

export async function getTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = await Template.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
}

export async function createTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, type, subject, body, isDefault } = req.body;
    if (!name || !body) { next(createError('Name and body are required', 400)); return; }
    if (isDefault) await Template.updateMany({ userId: req.userId }, { isDefault: false });
    const template = await Template.create({ userId: req.userId, name, type, subject, body, isDefault: isDefault || false });
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
}

export async function updateTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, type, subject, body, isDefault } = req.body;
    if (isDefault) await Template.updateMany({ userId: req.userId }, { isDefault: false });
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { name, type, subject, body, isDefault },
      { new: true, runValidators: true }
    );
    if (!template) { next(createError('Template not found', 404)); return; }
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
}

export async function deleteTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const template = await Template.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!template) { next(createError('Template not found', 404)); return; }
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
}

export async function previewTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.userId });
    if (!template) { next(createError('Template not found', 404)); return; }
    const sampleData = {
      firstName: req.body.firstName || 'John',
      lastName: req.body.lastName || 'Doe',
      company: req.body.company || 'Acme Corp',
      headline: req.body.headline || 'CEO at Acme Corp',
    };
    const rendered = personaliseTemplate(template.body, sampleData);
    const renderedSubject = personaliseTemplate(template.subject || '', sampleData);
    res.json({ success: true, data: { rendered, renderedSubject, charCount: rendered.length } });
  } catch (err) { next(err); }
}
