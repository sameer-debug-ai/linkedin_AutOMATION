import dotenv from 'dotenv';
dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
});

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI as string,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY as string,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  playwright: {
    headless: process.env.PLAYWRIGHT_HEADLESS === 'true',
    minDelayMs: Number(process.env.MIN_DELAY_MS) || 2000,
    maxDelayMs: Number(process.env.MAX_DELAY_MS) || 5000,
    dailyActionLimit: Number(process.env.DAILY_ACTION_LIMIT) || 25,
  },
  linkedin: {
    email: process.env.LINKEDIN_EMAIL || '',
    password: process.env.LINKEDIN_PASSWORD || '',
  },
};
