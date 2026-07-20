import mongoose, { Document, Schema, Types } from 'mongoose';

export type LeadStatus =
  | 'discovered'
  | 'request_sent'
  | 'connected'
  | 'messaged'
  | 'replied'
  | 'ignored';

export interface ILead extends Document {
  userId: Types.ObjectId;
  linkedinProfileUrl: string;
  name: string;
  headline: string;
  company: string;
  location: string;
  connectionDegree: '1st' | '2nd' | '3rd' | 'unknown';
  status: LeadStatus;
  templateUsed?: Types.ObjectId;
  messageSentAt?: Date;
  repliedAt?: Date;
  notes: string;
  tags: string[];
  leadScore: number;
  matchLevel: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    linkedinProfileUrl: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    headline: { type: String, default: '' },
    company: { type: String, default: '' },
    location: { type: String, default: '' },
    connectionDegree: { type: String, enum: ['1st', '2nd', '3rd', 'unknown'], default: 'unknown' },
    status: {
      type: String,
      enum: ['discovered', 'request_sent', 'connected', 'messaged', 'replied', 'ignored'],
      default: 'discovered',
      index: true,
    },
    templateUsed: { type: Schema.Types.ObjectId, ref: 'Template' },
    messageSentAt: { type: Date },
    repliedAt: { type: Date },
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
    leadScore: { type: Number, default: 50 },
    matchLevel: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  },
  { timestamps: true }
);

LeadSchema.index({ userId: 1, status: 1 });
LeadSchema.index({ userId: 1, createdAt: -1 });

export function calculateLeadScore(headline: string = '', company: string = ''): { leadScore: number; matchLevel: 'high' | 'medium' | 'low' } {
  const text = `${headline} ${company}`.toLowerCase();
  const highTier = ['founder', 'co-founder', 'owner', 'ceo', 'cto', 'cmo', 'managing director', 'vp', 'vice president', 'head of', 'partner'];
  const medTier = ['director', 'lead', 'manager', 'strategist', 'principal', 'consultant', 'recruiter'];
  
  if (highTier.some(keyword => text.includes(keyword))) {
    return { leadScore: Math.floor(Math.random() * 11) + 85, matchLevel: 'high' };
  }
  if (medTier.some(keyword => text.includes(keyword))) {
    return { leadScore: Math.floor(Math.random() * 11) + 70, matchLevel: 'medium' };
  }
  return { leadScore: Math.floor(Math.random() * 16) + 45, matchLevel: 'low' };
}

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
