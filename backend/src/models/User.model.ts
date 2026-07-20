import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  linkedinCookies: string;      // AES-encrypted JSON blob
  dailyLimit: number;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    linkedinCookies: { type: String, default: '' },
    dailyLimit: { type: Number, default: 300, min: 1, max: 1000 },
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function () {
  if (this.isModified('passwordHash')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).passwordHash = await bcrypt.hash((this as any).passwordHash, 12);
  }
});

UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

UserSchema.set('toJSON', {
  transform: (_doc: unknown, ret: any) => {
    ret.passwordHash = undefined;
    ret.linkedinCookies = undefined;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);
