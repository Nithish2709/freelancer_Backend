import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── mock DB so Sequelize never connects ──────────────────────────────────────
jest.mock('../config/db.js', () => ({
    sequelize: { define: jest.fn(), authenticate: jest.fn(), sync: jest.fn() },
    default: jest.fn()
}));

// ── mock User model ──────────────────────────────────────────────────────────
const mockUser = {
    id: 'user-uuid-1234',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'client',
    phoneNumber: '1234567890',
    profileImage: 'https://example.com/img.jpg',
    title: 'Developer',
    bio: 'A developer',
    skills: ['React'],
    location: 'NY',
    hourlyRate: 50,
    totalEarnings: 0,
    totalSpent: 0,
    newMessages: 0,
    matchPassword: jest.fn()
};

jest.mock('../models/User.js', () => {
    const m = { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
    return { __esModule: true, default: m };
});

jest.mock('../models/Project.js', () => {
    const m = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), belongsTo: jest.fn(), hasMany: jest.fn() };
    return { __esModule: true, default: m };
});

process.env.JWT_SECRET = 'testsecret';
process.env.NODE_ENV = 'test';

import app from '../app.js';
import User from '../models/User.js';

describe('Auth Routes', () => {

    beforeEach(() => jest.clearAllMocks());

    // ── POST /api/auth/register ──────────────────────────────────────────────
    describe('POST /api/auth/register', () => {
        it('should register a new user and return 201', async () => {
            User.findOne.mockResolvedValue(null);
            User.create.mockResolvedValue({ ...mockUser });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'Test User', email: 'test@example.com', password: 'password123', role: 'client' });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.email).toBe('test@example.com');
            expect(res.body.role).toBe('client');
        });

        it('should return 400 if user already exists', async () => {
            User.findOne.mockResolvedValue(mockUser);

            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('User already exists');
        });

        it('should return 500 on DB error', async () => {
            User.findOne.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .post('/api/auth/register')
                .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

            expect(res.statusCode).toBe(500);
        });
    });

    // ── POST /api/auth/login ─────────────────────────────────────────────────
    describe('POST /api/auth/login', () => {
        it('should login with valid credentials and return token', async () => {
            mockUser.matchPassword.mockResolvedValue(true);
            User.findOne.mockResolvedValue(mockUser);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.email).toBe('test@example.com');
        });

        it('should return 401 with invalid credentials', async () => {
            mockUser.matchPassword.mockResolvedValue(false);
            User.findOne.mockResolvedValue(mockUser);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('should return 401 if user not found', async () => {
            User.findOne.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nobody@example.com', password: 'password123' });

            expect(res.statusCode).toBe(401);
        });
    });

    // ── POST /api/auth/logout ────────────────────────────────────────────────
    describe('POST /api/auth/logout', () => {
        it('should logout and return 200', async () => {
            const res = await request(app).post('/api/auth/logout');
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Logged out successfully');
        });
    });

    // ── GET /api/auth/me ─────────────────────────────────────────────────────
    describe('GET /api/auth/me', () => {
        it('should return profile for authenticated user', async () => {
            const token = jwt.sign({ userId: mockUser.id }, 'testsecret');
            User.findByPk.mockResolvedValue(mockUser);

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body._id).toBe(mockUser.id);
            expect(res.body.email).toBe(mockUser.email);
        });

        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/auth/me');
            expect(res.statusCode).toBe(401);
        });

        it('should return 401 with invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalidtoken');
            expect(res.statusCode).toBe(401);
        });
    });
});
