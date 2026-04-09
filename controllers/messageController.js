import Message from '../models/Message.js';
import User from '../models/User.js';
import { Op } from 'sequelize';

const userAttrs = ['id', 'name', 'profileImage', 'title', 'role'];

// @desc  Get all conversations (inbox) for the logged-in user
// @route GET /api/messages
// @access Private
export const getInbox = async (req, res) => {
    try {
        const uid = req.user.id;

        // Get all messages involving this user
        const messages = await Message.findAll({
            where: {
                [Op.or]: [{ senderId: uid }, { receiverId: uid }]
            },
            include: [
                { model: User, as: 'sender',   attributes: userAttrs },
                { model: User, as: 'receiver', attributes: userAttrs },
            ],
            order: [['createdAt', 'DESC']]
        });

        // Build unique conversation list (one entry per other user)
        const seen = new Set();
        const conversations = [];
        for (const msg of messages) {
            const other = msg.senderId === uid ? msg.receiver : msg.sender;
            if (!other || seen.has(other.id)) continue;
            seen.add(other.id);
            const unread = await Message.count({
                where: { senderId: other.id, receiverId: uid, read: false }
            });
            conversations.push({ user: other, lastMessage: msg, unread });
        }

        res.json(conversations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Get conversation between logged-in user and another user
// @route GET /api/messages/:userId
// @access Private
export const getConversation = async (req, res) => {
    try {
        const uid = req.user.id;
        const otherId = req.params.userId;

        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { senderId: uid,     receiverId: otherId },
                    { senderId: otherId, receiverId: uid }
                ]
            },
            include: [
                { model: User, as: 'sender',   attributes: userAttrs },
                { model: User, as: 'receiver', attributes: userAttrs },
            ],
            order: [['createdAt', 'ASC']]
        });

        // Mark received messages as read
        await Message.update(
            { read: true },
            { where: { senderId: otherId, receiverId: uid, read: false } }
        );

        // Reset unread counter on the logged-in user
        await User.decrement('newMessages', {
            by: messages.filter(m => m.senderId === otherId && !m.read).length,
            where: { id: uid }
        });

        const otherUser = await User.findByPk(otherId, { attributes: userAttrs });
        res.json({ messages, otherUser });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Send a message
// @route POST /api/messages/:userId
// @access Private
export const sendMessage = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) return res.status(400).json({ message: 'Message content is required' });

        const uid      = req.user.id;
        const otherId  = req.params.userId;

        const receiver = await User.findByPk(otherId);
        if (!receiver) return res.status(404).json({ message: 'User not found' });

        const message = await Message.create({
            senderId:   uid,
            receiverId: otherId,
            content:    content.trim()
        });

        // Increment unread counter for receiver
        await receiver.increment('newMessages');

        const full = await Message.findByPk(message.id, {
            include: [
                { model: User, as: 'sender',   attributes: userAttrs },
                { model: User, as: 'receiver', attributes: userAttrs },
            ]
        });

        res.status(201).json(full);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
