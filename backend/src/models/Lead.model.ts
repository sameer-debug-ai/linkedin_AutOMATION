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
  },
  { timestamps: true }
);

LeadSchema.index({ userId: 1, status: 1 });
LeadSchema.index({ userId: 1, createdAt: -1 });

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
