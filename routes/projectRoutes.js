import express from 'express';
import {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    submitProposal,
    acceptProposal,
    assignProject,
    updateProjectStatus
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getProjects)
    .post(protect, createProject);

router.route('/:id')
    .get(getProjectById)
    .put(protect, updateProject)
    .delete(protect, deleteProject);

router.route('/:id/proposals')
    .post(protect, submitProposal);

router.route('/:id/proposals/:proposalId/accept')
    .put(protect, acceptProposal);

router.route('/:id/assign')
    .put(protect, assignProject);

router.route('/:id/status')
    .patch(protect, updateProjectStatus);

export default router;
