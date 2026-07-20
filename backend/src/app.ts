import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './config/logger';
import { initSocketServer } from './queue/socket';
import { createAutomationWorker } from './queue/automation.worker';
import { errorHandler, notFound } from './middleware/error-handler';
import { User } from './models/User.model';
import { Template } from './models/Template.model';

import authRoutes from './routes/auth.routes';
import leadsRoutes from './routes/leads.routes';
import templatesRoutes from './routes/templates.routes';
import automationRoutes from './routes/automation.routes';
import analyticsRoutes from './routes/analytics.routes';

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocalhost) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

async function seedDefaultTemplates(): Promise<void> {
  try {
    const users = await User.find({});
    for (const user of users) {
      const count = await Template.countDocuments({ userId: user._id });
      if (count === 0) {
        logger.info(`[Seed] Seeding default templates for user: ${user.email}`);
        await Template.insertMany([
          {
            userId: user._id,
            name: "Freelance Proposal (Connection Note)",
            type: "connection_note",
            subject: "",
            body: "Hi {{firstName}}, noticed you lead operations at {{company}}. I'm a freelance developer specializing in React/Node/Angular. If you ever need extra developer bandwidth on overflow project backlogs, I'd love to help out. Let's connect!",
            isDefault: true,
            usageCount: 0
          },
          {
            userId: user._id,
            name: "Software Service Outreach (Direct Message)",
            type: "direct_message",
            subject: "Development Bandwidth Support",
            body: "Hi {{firstName}},\n\nI see you're doing great work at {{company}}.\n\nI am a full-stack developer with 5+ years of experience helping agencies scale their development bandwidth. If you have any active project backlogs or need a reliable freelancer to delegate tasks to, I'd love to share my portfolio.\n\nBest,\n[Your Name]",
            isDefault: false,
            usageCount: 0
          },
          {
            userId: user._id,
            name: "Senior Full Stack Developer Pitch (Sameer Khan Email)",
            type: "email",
            subject: "Full Stack Developer Collaboration Opportunity - Sameer Khan",
            body: `Hello Team,

I hope you're doing well.

My name is Sameer Khan, and I'm a Senior Full Stack Developer with 7+ years of experience building scalable web applications, enterprise software, SaaS platforms, AI-powered solutions, and cloud infrastructure.

I'm reaching out to explore opportunities to collaborate with your agency on client projects. Whether you need additional development capacity, a dedicated remote developer, or someone to accelerate project delivery, I'd be happy to contribute.

### Technical Expertise

* MEAN & MERN Stack (MongoDB, Express.js, Angular, React.js, Node.js)
* Next.js, NestJS, TypeScript
* REST APIs & GraphQL
* MySQL, PostgreSQL, MongoDB
* DevOps: Docker, AWS, CI/CD, Linux, Deployment & Server Management
* AI & Automation: OpenAI APIs, AI Agents, Chatbots, Workflow Automation, LLM Integration
* Authentication, Payment Gateway Integration, Third-party APIs, Microservices

### How I Can Help

✔ Build complete web applications from scratch
✔ Develop scalable backend systems & APIs
✔ SaaS application development
✔ AI-powered applications & automation solutions
✔ DevOps setup and cloud deployment
✔ Bug fixing, performance optimization & code refactoring
✔ Long-term dedicated development support

I take pride in delivering clean, scalable, and maintainable code while ensuring transparent communication and on-time delivery. I enjoy working closely with agencies to help them successfully deliver projects for their clients.

If your team is looking for an experienced Full Stack Developer for current or upcoming projects, I'd love to discuss how I can add value.

Please feel free to reply to this email or schedule a quick call at your convenience.

Looking forward to hearing from you.

Best Regards,

Sameer Khan
Senior Full Stack Developer | MEAN | MERN | DevOps | AI Solutions
📧 sameerkhan87512@gmail.com
📱 7617468644
🔗 LinkedIn: https://www.linkedin.com/in/sameer-khan-7399ba2a3/`,
            isDefault: false,
            usageCount: 0
          }
        ]);
      } else {
        // Ensure Email template exists for existing users
        const emailTplCount = await Template.countDocuments({ userId: user._id, type: 'email' });
        if (emailTplCount === 0) {
          await Template.create({
            userId: user._id,
            name: "Senior Full Stack Developer Pitch (Sameer Khan Email)",
            type: "email",
            subject: "Full Stack Developer Collaboration Opportunity - Sameer Khan",
            body: `Hello Team,

I hope you're doing well.

My name is Sameer Khan, and I'm a Senior Full Stack Developer with 7+ years of experience building scalable web applications, enterprise software, SaaS platforms, AI-powered solutions, and cloud infrastructure.

I'm reaching out to explore opportunities to collaborate with your agency on client projects. Whether you need additional development capacity, a dedicated remote developer, or someone to accelerate project delivery, I'd be happy to contribute.

### Technical Expertise

* MEAN & MERN Stack (MongoDB, Express.js, Angular, React.js, Node.js)
* Next.js, NestJS, TypeScript
* REST APIs & GraphQL
* MySQL, PostgreSQL, MongoDB
* DevOps: Docker, AWS, CI/CD, Linux, Deployment & Server Management
* AI & Automation: OpenAI APIs, AI Agents, Chatbots, Workflow Automation, LLM Integration
* Authentication, Payment Gateway Integration, Third-party APIs, Microservices

### How I Can Help

✔ Build complete web applications from scratch
✔ Develop scalable backend systems & APIs
✔ SaaS application development
✔ AI-powered applications & automation solutions
✔ DevOps setup and cloud deployment
✔ Bug fixing, performance optimization & code refactoring
✔ Long-term dedicated development support

I take pride in delivering clean, scalable, and maintainable code while ensuring transparent communication and on-time delivery. I enjoy working closely with agencies to help them successfully deliver projects for their clients.

If your team is looking for an experienced Full Stack Developer for current or upcoming projects, I'd love to discuss how I can add value.

Please feel free to reply to this email or schedule a quick call at your convenience.

Looking forward to hearing from you.

Best Regards,

Sameer Khan
Senior Full Stack Developer | MEAN | MERN | DevOps | AI Solutions
📧 sameerkhan87512@gmail.com
📱 7617468644
🔗 LinkedIn: https://www.linkedin.com/in/sameer-khan-7399ba2a3/`,
            isDefault: false,
            usageCount: 0
          });
        }
      }
    }
  } catch (err) {
    logger.error('[Seed] Failed to seed default templates:', err);
  }
}

// Graceful shutdown — ensures port is freed before nodemon restarts
function shutdown(signal: string) {
  logger.info(`[Server] ${signal} received — shutting down gracefully...`);
  httpServer.close(() => {
    logger.info('[Server] HTTP server closed. Exiting.');
    process.exit(0);
  });
  // Force exit after 5s if connections hang
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Start
async function bootstrap(): Promise<void> {
  await connectDatabase();
  await seedDefaultTemplates();
  initSocketServer(httpServer);
  createAutomationWorker();

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${env.port} is already in use. Waiting for nodemon to retry...`);
      process.exit(1); // Clean exit so nodemon retries after delay
    } else {
      throw err;
    }
  });

  httpServer.listen(env.port, () => {
    logger.info(`🚀 Server running on http://localhost:${env.port}`);
    logger.info(`🔌 WebSocket server ready`);
    logger.info(`⚙️  Environment: ${env.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});

export default app;
