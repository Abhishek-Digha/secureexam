const mongoose = require('mongoose'); 
const express = require('express');
const Question = require('../models/Question');
const Session = require('../models/Session');
const Answer = require('../models/Answer');
const router = express.Router();

// Get questions for session
router.get('/questions/:sessionId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId).populate('questions');
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }
        
        // Randomize questions order
        const questions = session.questions.sort(() => Math.random() - 0.5);
        
        res.json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Submit exam endpoint
router.post('/submit-exam', async (req, res) => {
  try {
    const { sessionId, userId, answers } = req.body;

    // Fetch session and populate questions
    const session = await Session.findById(sessionId).populate('questions');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const questions = session.questions;

    // Convert answers array to a map keyed by questionId
    const answersMap = {};
    (answers || []).forEach(ans => {
      if (ans.questionId) {
        answersMap[ans.questionId.toString()] = ans;
      }
    });

    let score = 0;
    const formattedAnswers = [];

    // Loop through all questions to preserve unanswered
    questions.forEach(question => {
      const userAnswerObj = answersMap[question._id.toString()] || {};

      const isMCQ = question.type === 'mcq';
      const userSelectedAnswer = (userAnswerObj.selectedAnswer || '').toString().trim();
      const codeAnswer = (userAnswerObj.codeAnswer || '').toString().trim();

      const correctAnswerNormalized = (question.correctAnswer || '').toString().trim().toLowerCase();
      const isCorrect = isMCQ ? (userSelectedAnswer.toLowerCase() === correctAnswerNormalized) : null;

      if (isCorrect) score++;

      formattedAnswers.push({
        questionId: question._id,
        type: question.type,
        selectedAnswer: isMCQ ? (userSelectedAnswer || 'Not Answered') : null,
        codeAnswer: isMCQ ? null : (codeAnswer || 'Not Answered'),
        isCorrect
      });
    });

    const totalMCQs = questions.filter(q => q.type === 'mcq').length;

    // Save exam result
    const examResult = new Answer({
      sessionId,
      userId,
      answers: formattedAnswers,
      score,
      totalQuestions: totalMCQs,
      submittedAt: new Date()
    });

    await examResult.save();

    // Update session status as terminated
    await Session.findByIdAndUpdate(sessionId, { status: 'terminated' });

    // Emit exam termination event
    const io = req.app.get('io');
    if (io) {
      io.to(sessionId).emit('examTerminated');
      console.log(`Session ${sessionId} terminated due to user ${userId} submitting exam.`);
    }

    res.json({
      success: true,
      score,
      totalQuestions: totalMCQs,
      percentage: totalMCQs > 0 ? ((score / totalMCQs) * 100).toFixed(2) : 'N/A'
    });

  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});




// Auto-save answers


router.post('/auto-save', async (req, res) => {
  try {
    const { sessionId, userId, answers } = req.body;

    // Validate answers array
    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Answers must be an array' });
    }

    for (const ans of answers) {
      if (!ans.type || (ans.type !== 'mcq' && ans.type !== 'code')) {
        return res.status(400).json({ success: false, message: `Invalid or missing type for questionId ${ans.questionId}` });
      }
      if (!ans.questionId || !mongoose.Types.ObjectId.isValid(ans.questionId)) {
        return res.status(400).json({ success: false, message: `Invalid questionId: ${ans.questionId}` });
      }
    }

    let answerDoc = await Answer.findOne({ sessionId, userId });
    if (!answerDoc) {
      answerDoc = new Answer({ sessionId, userId, answers: [] });
    }

    // Update or add answers
    answers.forEach(ans => {
      const existingIndex = answerDoc.answers.findIndex(a => a.questionId.toString() === ans.questionId);
      const newAnswer = {
        questionId: ans.questionId,
        type: ans.type,
        selectedAnswer: ans.type === 'mcq' ? (ans.selectedAnswer ?? null) : null,
        codeAnswer: ans.type === 'code' ? (ans.codeAnswer ?? null) : null
      };
      if (existingIndex >= 0) {
        answerDoc.answers[existingIndex] = newAnswer;
      } else {
        answerDoc.answers.push(newAnswer);
      }
    });

    await answerDoc.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Auto-save error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});




module.exports = router;