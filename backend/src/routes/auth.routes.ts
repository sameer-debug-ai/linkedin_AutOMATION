import { Router } from 'express';
import { register, login, saveLinkedInSession, checkSessionStatus, triggerManualLogin } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/linkedin/login', authenticate, triggerManualLogin);
router.post('/linkedin/save-session', authenticate, saveLinkedInSession);
router.get('/linkedin/session-status', authenticate, checkSessionStatus);

export default router;
