import { v4 as uuidv4 } from 'uuid';
import Project from '../models/Project.js';
import User from '../models/User.js';

const clientAttributes = ['id', 'name', 'email', 'profileImage'];
const freelancerAttributes = ['id', 'name', 'profileImage', 'rating', 'title', 'skills', 'tools', 'bio', 'experience', 'portfolio'];

// @desc    Get all projects
// @route   GET /api/projects
// @access  Public
export const getProjects = async (req, res) => {
    try {
        const projects = await Project.findAll({
            include: [{ model: User, as: 'client', attributes: clientAttributes }]
        });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Public
export const getProjectById = async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id, {
            include: [{ model: User, as: 'client', attributes: clientAttributes }]
        });

        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Batch-fetch all proposal freelancers in one query
        const proposals = project.proposals || [];
        const freelancerIds = [...new Set(proposals.map(p => p.freelancer).filter(Boolean))];
        const freelancers = freelancerIds.length
            ? await User.findAll({ where: { id: freelancerIds }, attributes: freelancerAttributes })
            : [];
        const freelancerMap = Object.fromEntries(freelancers.map(f => [f.id, f]));
        const populatedProposals = proposals.map(p => ({ ...p, freelancer: freelancerMap[p.freelancer] || p.freelancer }));

        res.json({ ...project.toJSON(), proposals: populatedProposals });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a project
// @route   POST /api/projects
// @access  Private (Client only)
export const createProject = async (req, res) => {
    try {
        const { title, description, budget, skillsRequired, deadline } = req.body;

        if (req.user.role !== 'client') {
            return res.status(403).json({ message: 'Only clients can create projects' });
        }

        const numericBudget = Number(budget);
        if (isNaN(numericBudget) || numericBudget <= 0) {
            return res.status(400).json({ message: 'Budget must be a positive number' });
        }

        const project = await Project.create({
            title, description,
            budget: numericBudget,
            skillsRequired,
            deadline,
            clientId: req.user.id
        });

        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private
export const updateProject = async (req, res) => {
    try {
        const { title, description, budget, skillsRequired, status, deadline } = req.body;
        const project = await Project.findByPk(req.params.id);

        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (project.clientId !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized to update this project' });
        }

        await project.update({
            title: title || project.title,
            description: description || project.description,
            budget: budget || project.budget,
            skillsRequired: skillsRequired || project.skillsRequired,
            status: status || project.status,
            deadline: deadline || project.deadline
        });

        res.json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private
export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);

        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (project.clientId !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized to delete this project' });
        }

        await project.destroy();
        res.json({ message: 'Project removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit a proposal for a project
// @route   POST /api/projects/:id/proposals
// @access  Private (Freelancer only)
export const submitProposal = async (req, res) => {
    try {
        const { coverLetter, bidAmount } = req.body;

        if (req.user.role !== 'freelancer') {
            return res.status(403).json({ message: 'Only freelancers can submit proposals' });
        }

        const project = await Project.findByPk(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const proposals = project.proposals || [];
        const alreadySubmitted = proposals.find(p => p.freelancer === req.user.id);
        if (alreadySubmitted) {
            return res.status(400).json({ message: 'You have already submitted a proposal for this project' });
        }

        const newProposal = {
            _id: uuidv4(),
            freelancer: req.user.id,
            coverLetter,
            bidAmount,
            status: 'pending',
            createdAt: new Date()
        };

        await project.update({ proposals: [...proposals, newProposal] });
        res.status(201).json({ message: 'Proposal submitted successfully', project });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Accept a proposal
// @route   PUT /api/projects/:id/proposals/:proposalId/accept
// @access  Private (Client only)
export const acceptProposal = async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (project.clientId !== req.user.id) {
            return res.status(401).json({ message: 'Only the project owner can accept proposals' });
        }

        const proposals = project.proposals || [];
        const proposal = proposals.find(p => p._id === req.params.proposalId);
        if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

        await project.update({ status: 'assigned' });

        const [client, freelancer] = await Promise.all([
            User.findByPk(req.user.id),
            User.findByPk(proposal.freelancer)
        ]);

        if (client) await client.update({ totalSpent: (client.totalSpent || 0) + proposal.bidAmount });
        if (freelancer) await freelancer.update({
            totalEarnings: (freelancer.totalEarnings || 0) + proposal.bidAmount,
            jobsCompleted: (freelancer.jobsCompleted || 0) + 1
        });

        res.json({ message: 'Proposal accepted and project completed', project });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update project status (freelancer marks job as completed/pending)
// @route   PATCH /api/projects/:id/status
// @access  Private
export const updateProjectStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ['open', 'assigned', 'completed'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
        }

        const project = await Project.findByPk(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const uid = req.user.id;
        const isClient     = project.clientId === uid;
        const isAssigned   = project.assignedTo === uid;
        const hasProposal  = (project.proposals || []).some(p => p.freelancer === uid);

        if (!isClient && !isAssigned && !hasProposal) {
            return res.status(403).json({ message: 'Not authorized to update this project status' });
        }

        await project.update({ status });

        // If marked completed, update freelancer earnings/jobs count
        if (status === 'completed' && project.assignedTo) {
            const freelancer = await User.findByPk(project.assignedTo);
            if (freelancer && project.status !== 'completed') {
                await freelancer.update({
                    jobsCompleted: (freelancer.jobsCompleted || 0) + 1
                });
            }
        }

        res.json({ message: `Project status updated to ${status}`, project });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign project to a freelancer
// @route   PUT /api/projects/:id/assign
// @access  Private (Client only)
export const assignProject = async (req, res) => {
    try {
        const { freelancerId } = req.body;
        const project = await Project.findByPk(req.params.id);

        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (project.clientId !== req.user.id) {
            return res.status(401).json({ message: 'Only project owner can assign it' });
        }

        const proposals = (project.proposals || []).map(p =>
            p.freelancer === freelancerId ? { ...p, status: 'accepted' } : p
        );

        await project.update({ assignedTo: freelancerId, status: 'assigned', proposals });
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
