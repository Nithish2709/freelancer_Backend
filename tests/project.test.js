import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/db.js', () => ({
    sequelize: { define: jest.fn(), authenticate: jest.fn(), sync: jest.fn() },
    default: jest.fn()
}));

const clientUser = {
    id: 'client-uuid-001',
    name: 'Client User',
    email: 'client@example.com',
    role: 'client',
    profileImage: 'https://example.com/img.jpg',
    totalSpent: 0,
    update: jest.fn().mockResolvedValue(true)
};

const freelancerUser = {
    id: 'freelancer-uuid-001',
    name: 'Freelancer User',
    email: 'freelancer@example.com',
    role: 'freelancer',
    profileImage: 'https://example.com/img.jpg',
    totalEarnings: 0,
    jobsCompleted: 0,
    update: jest.fn().mockResolvedValue(true)
};

const mockProject = {
    id: 'project-uuid-001',
    title: 'Test Project',
    description: 'A test project',
    budget: 500,
    skillsRequired: ['React', 'Node.js'],
    status: 'open',
    clientId: 'client-uuid-001',
    proposals: [],
    deadline: '2 weeks',
    toJSON: jest.fn().mockReturnValue({
        id: 'project-uuid-001',
        title: 'Test Project',
        description: 'A test project',
        budget: 500,
        skillsRequired: ['React', 'Node.js'],
        status: 'open',
        clientId: 'client-uuid-001',
        proposals: [],
        deadline: '2 weeks'
    }),
    update: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true)
};

jest.mock('../models/User.js', () => {
    const m = { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), hasMany: jest.fn() };
    return { __esModule: true, default: m };
});
jest.mock('../models/Project.js', () => {
    const m = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), belongsTo: jest.fn() };
    return { __esModule: true, default: m };
});

process.env.JWT_SECRET = 'testsecret';
process.env.NODE_ENV = 'test';

import app from '../app.js';
import User from '../models/User.js';
import Project from '../models/Project.js';

const clientToken = jwt.sign({ userId: clientUser.id }, 'testsecret');
const freelancerToken = jwt.sign({ userId: freelancerUser.id }, 'testsecret');

describe('Project Routes', () => {

    beforeEach(() => jest.clearAllMocks());

    // ── GET /api/projects ────────────────────────────────────────────────────
    describe('GET /api/projects', () => {
        it('should return all projects', async () => {
            Project.findAll.mockResolvedValue([mockProject]);

            const res = await request(app).get('/api/projects');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
        });

        it('should return empty array when no projects', async () => {
            Project.findAll.mockResolvedValue([]);
            const res = await request(app).get('/api/projects');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('should return 500 on DB error', async () => {
            Project.findAll.mockRejectedValue(new Error('DB error'));
            const res = await request(app).get('/api/projects');
            expect(res.statusCode).toBe(500);
        });
    });

    // ── GET /api/projects/:id ────────────────────────────────────────────────
    describe('GET /api/projects/:id', () => {
        it('should return a project by id', async () => {
            Project.findByPk.mockResolvedValue(mockProject);
            User.findByPk.mockResolvedValue(null);

            const res = await request(app).get('/api/projects/project-uuid-001');
            expect(res.statusCode).toBe(200);
            expect(res.body.id).toBe('project-uuid-001');
        });

        it('should return 404 for non-existent project', async () => {
            Project.findByPk.mockResolvedValue(null);
            const res = await request(app).get('/api/projects/nonexistent-id');
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('Project not found');
        });
    });

    // ── POST /api/projects ───────────────────────────────────────────────────
    describe('POST /api/projects', () => {
        it('should create a project for a client', async () => {
            User.findByPk.mockResolvedValue(clientUser);
            Project.create.mockResolvedValue(mockProject);

            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'Test Project', description: 'A test project', budget: 500, skillsRequired: ['React'], deadline: '2 weeks' });

            expect(res.statusCode).toBe(201);
        });

        it('should return 403 if freelancer tries to create project', async () => {
            User.findByPk.mockResolvedValue(freelancerUser);

            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({ title: 'Test Project', description: 'A test project', budget: 500 });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe('Only clients can create projects');
        });

        it('should return 401 without token', async () => {
            const res = await request(app)
                .post('/api/projects')
                .send({ title: 'Test Project', description: 'A test project', budget: 500 });
            expect(res.statusCode).toBe(401);
        });
    });

    // ── PUT /api/projects/:id ────────────────────────────────────────────────
    describe('PUT /api/projects/:id', () => {
        it('should update a project owned by the client', async () => {
            User.findByPk.mockResolvedValue(clientUser);
            Project.findByPk.mockResolvedValue({ ...mockProject });

            const res = await request(app)
                .put('/api/projects/project-uuid-001')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'Updated Title' });

            expect(res.statusCode).toBe(200);
        });

        it('should return 401 if non-owner tries to update', async () => {
            User.findByPk.mockResolvedValue(freelancerUser);
            Project.findByPk.mockResolvedValue({ ...mockProject, clientId: 'other-client-id' });

            const res = await request(app)
                .put('/api/projects/project-uuid-001')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({ title: 'Hacked Title' });

            expect(res.statusCode).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            User.findByPk.mockResolvedValue(clientUser);
            Project.findByPk.mockResolvedValue(null);

            const res = await request(app)
                .put('/api/projects/nonexistent')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'Updated' });

            expect(res.statusCode).toBe(404);
        });
    });

    // ── DELETE /api/projects/:id ─────────────────────────────────────────────
    describe('DELETE /api/projects/:id', () => {
        it('should delete a project owned by the client', async () => {
            User.findByPk.mockResolvedValue(clientUser);
            Project.findByPk.mockResolvedValue({ ...mockProject });

            const res = await request(app)
                .delete('/api/projects/project-uuid-001')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Project removed');
        });

        it('should return 401 if non-owner tries to delete', async () => {
            User.findByPk.mockResolvedValue(freelancerUser);
            Project.findByPk.mockResolvedValue({ ...mockProject, clientId: 'other-client-id' });

            const res = await request(app)
                .delete('/api/projects/project-uuid-001')
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.statusCode).toBe(401);
        });
    });

    // ── POST /api/projects/:id/proposals ─────────────────────────────────────
    describe('POST /api/projects/:id/proposals', () => {
        it('should allow a freelancer to submit a proposal', async () => {
            User.findByPk.mockResolvedValue(freelancerUser);
            Project.findByPk.mockResolvedValue({ ...mockProject, proposals: [], update: jest.fn().mockResolvedValue(true) });

            const res = await request(app)
                .post('/api/projects/project-uuid-001/proposals')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({ coverLetter: 'I am the best fit', bidAmount: 400 });

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('Proposal submitted successfully');
        });

        it('should return 403 if client tries to submit proposal', async () => {
            User.findByPk.mockResolvedValue(clientUser);

            const res = await request(app)
                .post('/api/projects/project-uuid-001/proposals')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ coverLetter: 'I am the best fit', bidAmount: 400 });

            expect(res.statusCode).toBe(403);
        });

        it('should return 400 if freelancer already submitted', async () => {
            User.findByPk.mockResolvedValue(freelancerUser);
            Project.findByPk.mockResolvedValue({
                ...mockProject,
                proposals: [{ freelancer: freelancerUser.id, coverLetter: 'Already submitted', bidAmount: 300 }]
            });

            const res = await request(app)
                .post('/api/projects/project-uuid-001/proposals')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({ coverLetter: 'Duplicate', bidAmount: 400 });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/already submitted/i);
        });
    });

    // ── PUT /api/projects/:id/proposals/:proposalId/accept ───────────────────
    describe('PUT /api/projects/:id/proposals/:proposalId/accept', () => {
        it('should accept a proposal and complete the project', async () => {
            const proposalId = 'proposal-uuid-001';
            User.findByPk
                .mockResolvedValueOnce(clientUser)   // auth middleware
                .mockResolvedValueOnce(clientUser)   // client update
                .mockResolvedValueOnce(freelancerUser); // freelancer update

            Project.findByPk.mockResolvedValue({
                ...mockProject,
                clientId: clientUser.id,
                proposals: [{ _id: proposalId, freelancer: freelancerUser.id, bidAmount: 400 }],
                update: jest.fn().mockResolvedValue(true)
            });

            const res = await request(app)
                .put(`/api/projects/project-uuid-001/proposals/${proposalId}/accept`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Proposal accepted and project completed');
        });

        it('should return 404 if proposal not found', async () => {
            User.findByPk.mockResolvedValue(clientUser);
            Project.findByPk.mockResolvedValue({
                ...mockProject,
                clientId: clientUser.id,
                proposals: []
            });

            const res = await request(app)
                .put('/api/projects/project-uuid-001/proposals/nonexistent/accept')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('Proposal not found');
        });
    });

    // ── PUT /api/projects/:id/assign ─────────────────────────────────────────
    describe('PUT /api/projects/:id/assign', () => {
        it('should assign a project to a freelancer', async () => {
            User.findByPk.mockResolvedValue(clientUser);
            Project.findByPk.mockResolvedValue({
                ...mockProject,
                clientId: clientUser.id,
                proposals: [{ freelancer: freelancerUser.id, status: 'pending' }],
                update: jest.fn().mockResolvedValue(true)
            });

            const res = await request(app)
                .put('/api/projects/project-uuid-001/assign')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ freelancerId: freelancerUser.id });

            expect(res.statusCode).toBe(200);
        });

        it('should return 401 if non-owner tries to assign', async () => {
            User.findByPk.mockResolvedValue(freelancerUser);
            Project.findByPk.mockResolvedValue({ ...mockProject, clientId: 'other-client-id' });

            const res = await request(app)
                .put('/api/projects/project-uuid-001/assign')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({ freelancerId: freelancerUser.id });

            expect(res.statusCode).toBe(401);
        });
    });
});
