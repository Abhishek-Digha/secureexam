 
const express = require('express');
const Question = require('../models/Question');
const Session = require('../models/Session');
const Answer = require('../models/Answer');
const { User } = require('../models/User');
const { generatePDF } = require('../utils/pdfGenerator');
const router = express.Router();

// Question management
router.get('/questions', async (req, res) => {
    try {
        const questions = await Question.find().sort({ createdAt: -1 });
        res.json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /admin/questions - create new question
router.post('/questions', async (req, res) => {
  try {
    const {
      text,
      type,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      codingTemplate,
      difficulty,
      category
    } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Question text is required' });
    }

    if (!['mcq', 'code'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid question type' });
    }

    if (type === 'mcq') {
      if (!optionA || !optionB || !optionC || !optionD || !correctAnswer) {
        return res.status(400).json({ success: false, message: 'MCQ options and correct answer are required' });
      }
    } else if (type === 'code') {
      if (!codingTemplate) {
        return res.status(400).json({ success: false, message: 'Coding template is required for code questions' });
      }
    }

    const newQuestion = new Question({
      text,
      type,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      codingTemplate,
      difficulty: difficulty || 'medium',
      category: category || 'general',
      createdBy: req.user ? req.user._id : null  // ensure authentication middleware assigns req.user
    });

    await newQuestion.save();

    res.json({ success: true, question: newQuestion });

  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.delete('/questions/:id', async (req, res) => {
    try {
        await Question.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Session management
router.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.find().sort({ createdAt: -1 });
        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/sessions', async (req, res) => {
  try {
    const { name, startTime, duration, questions } = req.body;

    let questionsToAttach = [];

    if (Array.isArray(questions) && questions.length > 0) {
      questionsToAttach = questions;
    } else {
      // Fallback: load all questions from DB if none sent
      const allQuestions = await Question.find();
      questionsToAttach = allQuestions.map(q => q._id);
    }

    const session = new Session({
      name,
      startTime,
      duration,
      questions: questionsToAttach
    });

    await session.save();
    res.json({ success: true, session });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.post('/sessions/:id/activate', async (req, res) => {
    try {
        const session = await Session.findByIdAndUpdate(
            req.params.id,
            { status: 'active' },
            { new: true }
        );
        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/sessions/:id/terminate', async (req, res) => {
    try {
        const session = await Session.findByIdAndUpdate(
            req.params.id,
            { status: 'terminated' },
            { new: true }
        );
        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.delete('/sessions/:id', async (req, res) => {
    try {
        await Session.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.get('/reports', async (_, res) => {
  try {
    const reports = await Answer.find()
      .populate('userId')
      .populate('sessionId')
      .sort({ submittedAt: -1 });

    const formattedReports = reports.map(report => ({
      id: report._id,
      user: {
        name: report.userId ? report.userId.name : 'Unknown User',
        email: report.userId ? report.userId.email : 'N/A',
        mobile: report.userId ? report.userId.mobile : 'N/A',
      },
      session: {
        name: report.sessionId ? report.sessionId.name : 'Unknown Session',
        code: report.sessionId ? report.sessionId.code : 'N/A',
      },
      score: report.score,
      totalQuestions: report.totalQuestions,
      submittedAt: report.submittedAt
    }));

    res.json({ success: true, reports: formattedReports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/reports/:id/pdf', async (req, res) => {
  try {
    const report = await Answer.findById(req.params.id)
      .populate('userId')
      .populate('sessionId')
      .populate('answers.questionId');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const pdfBuffer = await generatePDF(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=exam-report-${report._id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF report:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Attach or replace questions for a session
router.put('/:sessionId/attach-questions', async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Questions array is required.' });
    }

    // Make sure all IDs are valid Mongo ObjectIds (optional strictness)
    // const areValid = questions.every(id => mongoose.Types.ObjectId.isValid(id));
    // if (!areValid) { ... }

    const updatedSession = await Session.findByIdAndUpdate(
      req.params.sessionId,
      { $set: { questions } },
      { new: true }
    ).populate('questions');

    if (!updatedSession) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    return res.json({ success: true, session: updatedSession });
  } catch (error) {
    console.error('Error attaching questions:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;