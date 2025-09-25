const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Admin } = require('../models/User');
const Session = require('../models/Session');
const Question = require('../models/Question');
const router = express.Router();

// Admin login
router.post('/admin-login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        let admin = await Admin.findOne({ username: username.toLowerCase().trim() });

        // Create default admin if none exists
        if (!admin) {
            admin = new Admin({ username: 'admin', password: 'admin123' });
            await admin.save();
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        res.json({
            success: true,
            user: { id: admin._id, username: admin.username, role: admin.role }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// User join session
router.post('/user-join', async (req, res) => {
    try {
        const { name, email, mobile, sessionCode } = req.body;

        if (!name || !email || !mobile || !sessionCode) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Normalize session code (case-insensitive)
        const normalizedCode = sessionCode.toUpperCase().trim();

        const session = await Session.findOne({ code: normalizedCode, status: 'active' });
        if (!session) {
            return res.status(404).json({ success: false, message: 'Invalid or inactive session' });
        }

        const user = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            mobile: mobile.trim(),
            sessionId: session._id
        });

        await user.save();

        // Add user to session participants if not already added
        if (!session.participants.includes(user._id)) {
            session.participants.push(user._id);
            await session.save();
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile
            },
            session: {
                id: session._id,
                name: session.name,
                duration: session.duration,
                status: session.status
            }
        });
    } catch (error) {
        console.error('User join error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Debug route to create test session (Temporary GET for easy browser test)
router.get('/debug/create-test-session', async (req, res) => {
  try {
    const questions = await Question.find({});
    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions found. Please create questions first.'
      });
    }
    const existingSession = await Session.findOne({ code: 'TEST01' });
    if (existingSession) {
      return res.json({
        success: true,
        message: 'Test session already exists',
        session: existingSession
      });
    }

    const testSession = new Session({
      name: 'Test Exam Session',
      code: 'TEST01',
      startTime: new Date(),
      duration: 60,
      status: 'active',
      questions: questions.map(q => q._id)
    });
    await testSession.save();
    res.json({
      success: true,
      message: 'Test session created successfully',
      session: {
        id: testSession._id,
        name: testSession.name,
        code: testSession.code,
        status: testSession.status,
        questionCount: testSession.questions.length
      }
    });
  } catch (error) {
    console.error('Create test session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



module.exports = router;
