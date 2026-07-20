import mongoose, { Document, Schema, Types } from 'mongoose';

export type TemplateType = 'connection_note' | 'direct_message' | 'inmail';

export interface ITemplate extends Document {
  userId: Types.ObjectId;
  name: string;
  type: TemplateType;
  subject: string;
  body: string;              // Supports {{firstName}}, {{lastName}}, {{company}}, {{headline}}
  isDefault: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['connection_note', 'direct_message', 'inmail'],
      default: 'connection_note',
    },
    subject: { type: String, default: '' },
    body: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Template = mongoose.model<ITemplate>('Template', TemplateSchema);
