import { Router } from 'express';
import { startJob, pauseJob, resumeJob, stopJob, getJobs, getJob, getDailyUsage } from '../controllers/automation.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/start', startJob);
router.get('/jobs', getJobs);
router.get('/daily-usage', getDailyUsage);
router.get('/jobs/:jobId', getJob);
router.post('/pause/:jobId', pauseJob);
router.post('/resume/:jobId', resumeJob);
router.post('/stop/:jobId', stopJob);

export default router;
