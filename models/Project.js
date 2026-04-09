import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import User from './User.js';

const Project = sequelize.define('Project', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    budget: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    skillsRequired: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    status: {
        type: DataTypes.ENUM('open', 'assigned', 'completed'),
        defaultValue: 'open'
    },
    assignedTo: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: User, key: 'id' }
    },
    proposals: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    deadline: DataTypes.STRING
}, {
    timestamps: true
});

Project.belongsTo(User, { as: 'client', foreignKey: 'clientId' });
User.hasMany(Project, { foreignKey: 'clientId' });

export default Project;
