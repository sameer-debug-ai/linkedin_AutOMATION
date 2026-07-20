import { Router } from 'express';
import { getSummary, getDailyTrend, getConversionByTemplate, getLogs } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/summary', getSummary);
router.get('/daily-trend', getDailyTrend);
router.get('/conversion-rate', getConversionByTemplate);
router.get('/logs', getLogs);

export default router;
