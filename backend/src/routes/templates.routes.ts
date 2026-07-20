import { Router } from 'express';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, previewTemplate } from '../controllers/templates.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/preview', previewTemplate);

export default router;
