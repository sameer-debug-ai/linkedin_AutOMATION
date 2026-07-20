import { Router } from 'express';
import { getLeads, getLead, updateLeadStatus, deleteLead, exportLeadsCsv } from '../controllers/leads.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getLeads);
router.get('/export/csv', exportLeadsCsv);
router.get('/:id', getLead);
router.patch('/:id/status', updateLeadStatus);
router.delete('/:id', deleteLead);

export default router;
