import express from 'express';
import { getInbox, getConversation, sendMessage } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/',           protect, getInbox);
router.get('/:userId',    protect, getConversation);
router.post('/:userId',   protect, sendMessage);

export default router;
