import mongoose, { Document, Schema, Types } from 'mongoose';

export type ActivityAction =
  | 'search'
  | 'profile_visit'
  | 'connect_sent'
  | 'message_sent'
  | 'reply_received'
  | 'connected'
  | 'replied'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'captcha_detected'
  | 'error';

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  leadId?: Types.ObjectId;
  jobId?: string;
  action: ActivityAction;
  details: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    jobId: { type: String },
    action: {
      type: String,
      enum: ['search','profile_visit','connect_sent','message_sent','reply_received','connected','replied','job_started','job_completed','job_failed','captcha_detected','error'],
      required: true,
    },
    details: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ userId: 1, action: 1, timestamp: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
