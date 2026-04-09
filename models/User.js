import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/db.js';

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('client', 'freelancer'),
        defaultValue: 'client'
    },
    phoneNumber: DataTypes.STRING,
    experience: DataTypes.STRING,
    portfolio: DataTypes.STRING,
    companyName: DataTypes.STRING,
    projectInterests: DataTypes.TEXT,
    title: DataTypes.STRING,
    bio: DataTypes.TEXT,
    skills: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    tools: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    hourlyRate: DataTypes.FLOAT,
    totalEarnings: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    totalSpent: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    newMessages: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    rating: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    jobsCompleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    location: DataTypes.STRING,
    profileImage: {
        type: DataTypes.STRING,
        defaultValue: null
    },
    profileComplete: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    hooks: {
        beforeSave: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

User.prototype.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default User;
