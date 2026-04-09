import dotenv from 'dotenv';
dotenv.config();

// Mock sequelize so tests don't need a real DB
jest.mock('../config/db.js', () => {
    const SequelizeMock = require('sequelize-mock');
    const dbMock = new SequelizeMock();
    return {
        sequelize: dbMock,
        default: jest.fn().mockResolvedValue(true)
    };
});
