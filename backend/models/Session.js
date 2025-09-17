const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const sessionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { 
        type: String, 
        unique: true, 
        default: () => {
            // Generate a more user-friendly 6-character code
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let result = '';
            for (let i = 0; i < 6; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
    },
    startTime: { type: Date, required: true },
    duration: { type: Number, required: true }, // in minutes
    status: { type: String, enum: ['pending', 'active', 'completed', 'terminated'], default: 'pending' },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
