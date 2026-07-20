import { Router } from 'express';
import { startJob, startBulkJob, discoverClients, pauseJob, resumeJob, stopJob, getJobs, getJob, getDailyUsage, syncResponses } from '../controllers/automation.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/start', startJob);
router.post('/discover-clients', discoverClients);
router.post('/bulk-start', startBulkJob);
router.post('/sync-responses', syncResponses);
router.get('/jobs', getJobs);
router.get('/daily-usage', getDailyUsage);
router.get('/jobs/:jobId', getJob);
router.post('/pause/:jobId', pauseJob);
router.post('/resume/:jobId', resumeJob);
router.post('/stop/:jobId', stopJob);

export default router;
