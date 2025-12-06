import { Router } from 'express';
import { getIVRWithUser, getAllIVRWithUsers } from '../controllers/ivrController';

const router = Router();

router.get('/', getAllIVRWithUsers);
router.get('/:sessionId', getIVRWithUser);

export default router;
