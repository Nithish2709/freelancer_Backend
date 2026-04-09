import jwt from 'jsonwebtoken';

jest.mock('../config/db.js', () => ({
    sequelize: { define: jest.fn(), authenticate: jest.fn(), sync: jest.fn() },
    default: jest.fn()
}));

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

import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('Auth Middleware - protect', () => {

    beforeEach(() => jest.clearAllMocks());

    it('should call next() with valid Bearer token', async () => {
        const userId = 'user-uuid-001';
        const token = jwt.sign({ userId }, 'testsecret');
        const mockUser = { id: userId, name: 'Test', role: 'client' };

        User.findByPk.mockResolvedValue(mockUser);

        const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(mockUser);
    });

    it('should call next() with valid cookie token', async () => {
        const userId = 'user-uuid-001';
        const token = jwt.sign({ userId }, 'testsecret');
        const mockUser = { id: userId, name: 'Test', role: 'client' };

        User.findByPk.mockResolvedValue(mockUser);

        const req = { cookies: { jwt: token }, headers: {} };
        const res = mockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(mockUser);
    });

    it('should return 401 when no token provided', async () => {
        const req = { cookies: {}, headers: {} };
        const res = mockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid token', async () => {
        const req = { cookies: {}, headers: { authorization: 'Bearer invalidtoken' } };
        const res = mockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, token failed' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when user not found in DB', async () => {
        const token = jwt.sign({ userId: 'ghost-user' }, 'testsecret');
        User.findByPk.mockResolvedValue(null);

        const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, user not found' });
        expect(next).not.toHaveBeenCalled();
    });
});
