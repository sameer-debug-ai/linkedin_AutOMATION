import mongoose, { Document, Schema, Types } from 'mongoose';

export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ActionType = 'connect' | 'message' | 'both';

export interface IJobConfig {
  keywords: string[];
  location: string;
  targetCount: number;
  templateId: Types.ObjectId;
  actionType: ActionType;
}

export interface IJobProgress {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
}

export interface IAutomationJob extends Document {
  userId: Types.ObjectId;
  bullJobId?: string;
  status: JobStatus;
  config: IJobConfig;
  progress: IJobProgress;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationJobSchema = new Schema<IAutomationJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bullJobId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    config: {
      keywords: { type: [String], required: true },
      location: { type: String, required: true },
      targetCount: { type: Number, default: 20, min: 1, max: 50 },
      templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
      actionType: { type: String, enum: ['connect', 'message', 'both'], default: 'connect' },
    },
    progress: {
      processed: { type: Number, default: 0 },
      successful: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    errorMessage: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const AutomationJob = mongoose.model<IAutomationJob>('AutomationJob', AutomationJobSchema);
