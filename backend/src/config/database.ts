import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.mongoUri);
    logger.info(`✅ MongoDB connected: ${env.mongoUri}`);
  } catch (err) {
    logger.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => logger.warn('⚠️ MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('✅ MongoDB reconnected'));
}
