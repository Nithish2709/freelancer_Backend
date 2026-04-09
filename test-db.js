import dotenv from 'dotenv';
dotenv.config();

import connectDB, { sequelize } from './config/db.js';
import User from './models/User.js';

const testDB = async () => {
    try {
        console.log('Connecting to PostgreSQL...');
        await connectDB();
        console.log('Connected successfully!');

        console.log('Testing User model...');
        const users = await User.findAll({ limit: 1 });
        console.log('User model works. Found:', users.length, 'users');

        await sequelize.close();
        process.exit(0);
    } catch (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
};

testDB();
