import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../config/db.js', () => ({
    sequelize: { define: jest.fn(), authenticate: jest.fn(), sync: jest.fn() },
    default: jest.fn()
}));

const mockFreelancer = {
    id: 'freelancer-uuid-001',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'freelancer',
    title: 'Full Stack Developer',
    bio: 'Experienced developer',
    skills: ['React', 'Node.js'],
    tools: ['VS Code', 'Figma'],
    location: 'NYC',
    hourlyRate: 75,
    totalEarnings: 1000,
    totalSpent: 0,
    newMessages: 2,
    profileImage: 'https://example.com/img.jpg',
    phoneNumber: '9876543210',
    experience: '5 years',
    portfolio: 'https://portfolio.example.com',
    companyName: null,
    projectInterests: null,
    update: jest.fn().mockResolvedValue(true)
};

const mockClient = {
    id: 'client-uuid-001',
    name: 'John Client',
    email: 'john@example.com',
    role: 'client',
    update: jest.fn().mockResolvedValue(true)
};

jest.mock('../models/User.js', () => {
    const m = { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn(), hasMany: jest.fn() };
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

const freelancerToken = jwt.sign({ userId: mockFreelancer.id }, 'testsecret');
const clientToken = jwt.sign({ userId: mockClient.id }, 'testsecret');

describe('User Routes', () => {

    beforeEach(() => jest.clearAllMocks());

    // ── GET /api/users/freelancers ───────────────────────────────────────────
    describe('GET /api/users/freelancers', () => {
        it('should return list of freelancers', async () => {
            User.findAll.mockResolvedValue([mockFreelancer]);

            const res = await request(app).get('/api/users/freelancers');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
        });

        it('should return empty array when no freelancers', async () => {
            User.findAll.mockResolvedValue([]);
            const res = await request(app).get('/api/users/freelancers');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('should filter freelancers by keyword', async () => {
            User.findAll.mockResolvedValue([mockFreelancer]);
            const res = await request(app).get('/api/users/freelancers?keyword=React');
            expect(res.statusCode).toBe(200);
            expect(User.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ role: 'freelancer' })
                })
            );
        });

        it('should return 500 on DB error', async () => {
            User.findAll.mockRejectedValue(new Error('DB error'));
            const res = await request(app).get('/api/users/freelancers');
            expect(res.statusCode).toBe(500);
        });
    });

    // ── GET /api/users/profile ───────────────────────────────────────────────
    describe('GET /api/users/profile', () => {
        it('should return profile for authenticated user', async () => {
            User.findByPk.mockResolvedValue(mockFreelancer);

            const res = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.id).toBe(mockFreelancer.id);
        });

        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/users/profile');
            expect(res.statusCode).toBe(401);
        });

        it('should return 404 if user not found', async () => {
            User.findByPk
                .mockResolvedValueOnce(mockFreelancer)  // auth middleware
                .mockResolvedValueOnce(null);            // getUserProfile controller

            const res = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    // ── PUT /api/users/profile ───────────────────────────────────────────────
    describe('PUT /api/users/profile', () => {
        it('should update user profile', async () => {
            User.findByPk.mockResolvedValue({ ...mockFreelancer });

            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({ name: 'Jane Updated', bio: 'Updated bio', skills: ['React', 'TypeScript'] });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('name');
        });

        it('should return 401 without token', async () => {
            const res = await request(app)
                .put('/api/users/profile')
                .send({ name: 'Jane Updated' });
            expect(res.statusCode).toBe(401);
        });

        it('should return 404 if user not found', async () => {
            User.findByPk
                .mockResolvedValueOnce(mockFreelancer)  // auth middleware
                .mockResolvedValueOnce(null);            // updateUserProfile controller

            const res = await request(app)
                .put('/api/users/profile')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({ name: 'Jane Updated' });

            expect(res.statusCode).toBe(404);
        });
    });

    // ── GET /api/users/:id ───────────────────────────────────────────────────
    describe('GET /api/users/:id', () => {
        it('should return a user by id', async () => {
            User.findByPk.mockResolvedValue(mockFreelancer);

            const res = await request(app).get(`/api/users/${mockFreelancer.id}`);
            expect(res.statusCode).toBe(200);
            expect(res.body.id).toBe(mockFreelancer.id);
        });

        it('should return 404 for non-existent user', async () => {
            User.findByPk.mockResolvedValue(null);

            const res = await request(app).get('/api/users/nonexistent-id');
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('User not found');
        });

        it('should return 500 on DB error', async () => {
            User.findByPk.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/users/some-id');
            expect(res.statusCode).toBe(500);
        });
    });
});
