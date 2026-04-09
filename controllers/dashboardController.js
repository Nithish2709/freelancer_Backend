import { Op, fn, col, literal } from 'sequelize';
import Project from '../models/Project.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

// @desc  Get all dashboard stats for the logged-in user
// @route GET /api/dashboard/stats
// @access Private
export const getDashboardStats = async (req, res) => {
    try {
        const uid  = req.user.id;
        const role = req.user.role;

        // ── Date helpers ──────────────────────────────────────
        const now          = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrev  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrev    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        // ── Fetch all projects relevant to this user ──────────
        const allProjects = await Project.findAll({
            attributes: ['id', 'status', 'budget', 'clientId', 'assignedTo', 'proposals', 'updatedAt'],
        });

        const userProjects = allProjects.filter(p => {
            if (role === 'client') {
                return p.clientId === uid;
            }
            // freelancer: assigned or has a proposal
            return (
                p.assignedTo === uid ||
                (p.proposals || []).some(prop => prop.freelancer === uid)
            );
        });

        // ── Unread messages ───────────────────────────────────
        const unreadCount = await Message.count({
            where: { receiverId: uid, read: false }
        });

        // ── Role-specific stats ───────────────────────────────
        let totalEarnings   = 0;
        let totalSpent      = 0;
        let jobsCompleted   = 0;
        let activeJobs      = 0;
        let monthlyEarnings = 0;
        let prevEarnings    = 0;
        let monthlyGrowth   = 0;

        if (role === 'freelancer') {
            // Jobs completed = projects where freelancer is assignedTo and status=completed
            const completedProjects = userProjects.filter(p =>
                p.assignedTo === uid && p.status === 'completed'
            );
            jobsCompleted = completedProjects.length;

            // Active = assigned but not completed
            activeJobs = userProjects.filter(p =>
                p.assignedTo === uid && p.status === 'assigned'
            ).length;

            // Total earnings = sum of budgets of completed projects assigned to this freelancer
            totalEarnings = completedProjects.reduce((sum, p) => sum + (p.budget || 0), 0);

            // Monthly earnings = completed this month
            monthlyEarnings = completedProjects
                .filter(p => new Date(p.updatedAt) >= startOfMonth)
                .reduce((sum, p) => sum + (p.budget || 0), 0);

            // Previous month earnings
            prevEarnings = completedProjects
                .filter(p => {
                    const d = new Date(p.updatedAt);
                    return d >= startOfPrev && d <= endOfPrev;
                })
                .reduce((sum, p) => sum + (p.budget || 0), 0);

            // Also sync User.totalEarnings and User.jobsCompleted in DB if drifted
            const userRecord = await User.findByPk(uid);
            if (userRecord && (userRecord.totalEarnings !== totalEarnings || userRecord.jobsCompleted !== jobsCompleted)) {
                await userRecord.update({ totalEarnings, jobsCompleted });
            }

        } else {
            // Client stats
            jobsCompleted = userProjects.filter(p => p.status === 'completed').length;
            activeJobs    = userProjects.filter(p => p.status === 'assigned' || p.status === 'open').length;

            // Total spent = sum of completed project budgets
            totalSpent = userProjects
                .filter(p => p.status === 'completed')
                .reduce((sum, p) => sum + (p.budget || 0), 0);

            // Monthly spent
            monthlyEarnings = userProjects
                .filter(p => p.status === 'completed' && new Date(p.updatedAt) >= startOfMonth)
                .reduce((sum, p) => sum + (p.budget || 0), 0);

            prevEarnings = userProjects
                .filter(p => {
                    const d = new Date(p.updatedAt);
                    return p.status === 'completed' && d >= startOfPrev && d <= endOfPrev;
                })
                .reduce((sum, p) => sum + (p.budget || 0), 0);

            // Sync User.totalSpent
            const userRecord = await User.findByPk(uid);
            if (userRecord && userRecord.totalSpent !== totalSpent) {
                await userRecord.update({ totalSpent });
            }
        }

        // ── Monthly growth % ──────────────────────────────────
        if (prevEarnings > 0) {
            monthlyGrowth = Math.round(((monthlyEarnings - prevEarnings) / prevEarnings) * 100);
        } else if (monthlyEarnings > 0) {
            monthlyGrowth = 100; // first month with earnings
        } else {
            monthlyGrowth = 0;
        }

        // ── Recent projects (last 5) ──────────────────────────
        const recentProjects = userProjects
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 5)
            .map(p => ({
                id:     p.id,
                status: p.status,
                budget: p.budget,
            }));

        res.json({
            totalEarnings:   role === 'freelancer' ? totalEarnings : totalSpent,
            monthlyEarnings,
            monthlyGrowth,
            jobsCompleted,
            activeJobs,
            totalProjects:   userProjects.length,
            notifications:   unreadCount,
            recentProjects,
        });

    } catch (err) {
        console.error('Dashboard stats error:', err.message);
        res.status(500).json({ message: err.message });
    }
};
