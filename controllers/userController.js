import { Op } from 'sequelize';
import User from '../models/User.js';

// @desc    Get all freelancers
// @route   GET /api/users/freelancers
// @access  Public
export const getFreelancers = async (req, res) => {
    try {
        const where = { role: 'freelancer' };

        if (req.query.keyword) {
            where.skills = { [Op.contains]: [req.query.keyword] };
        }

        const freelancers = await User.findAll({
            where,
            attributes: { exclude: ['password'] }
        });
        res.json(freelancers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });

        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        const fields = ['name', 'title', 'bio', 'skills', 'tools', 'location', 'hourlyRate',
            'profileImage', 'phoneNumber', 'experience', 'portfolio', 'companyName', 'projectInterests'];

        const updates = {};
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
        if (req.body.password) updates.password = req.body.password;

        await user.update(updates);

        // Compute profileComplete after update
        const updated = await User.findByPk(req.user.id);
        const isComplete = updated.role === 'freelancer'
            ? !!(updated.name && updated.bio && updated.phoneNumber && updated.skills?.length > 0 && updated.experience && updated.title)
            : !!(updated.name && updated.bio && updated.phoneNumber && updated.companyName);

        if (isComplete && !updated.profileComplete) {
            await updated.update({ profileComplete: true });
        }

        res.json({
            _id: updated.id,
            name: updated.name,
            email: updated.email,
            role: updated.role,
            title: updated.title,
            profileImage: updated.profileImage,
            bio: updated.bio,
            skills: updated.skills,
            tools: updated.tools,
            location: updated.location,
            hourlyRate: updated.hourlyRate,
            phoneNumber: updated.phoneNumber,
            experience: updated.experience,
            portfolio: updated.portfolio,
            companyName: updated.companyName,
            projectInterests: updated.projectInterests,
            totalEarnings: updated.totalEarnings,
            totalSpent: updated.totalSpent,
            newMessages: updated.newMessages,
            profileComplete: updated.profileComplete
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get freelancer by ID
// @route   GET /api/users/:id
// @access  Public
export const getUserById = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password'] }
        });

        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
