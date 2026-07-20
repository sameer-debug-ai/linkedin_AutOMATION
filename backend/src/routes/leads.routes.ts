import { Router } from 'express';
import { getLeads, getLead, updateLeadStatus, deleteLead, exportLeadsCsv, generateAiPitch } from '../controllers/leads.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getLeads);
router.get('/export/csv', exportLeadsCsv);
router.get('/:id', getLead);
router.get('/:id/ai-pitch', generateAiPitch);
router.patch('/:id/status', updateLeadStatus);
router.delete('/:id', deleteLead);

export default router;
