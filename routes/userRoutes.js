import express from 'express';
import {
    getFreelancers,
    getUserProfile,
    updateUserProfile,
    getUserById
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/freelancers', getFreelancers);

router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile);

router.get('/:id', getUserById);

export default router;
