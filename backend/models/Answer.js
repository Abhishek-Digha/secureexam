const mongoose = require('mongoose');

const answerItemSchema = new mongoose.Schema({
  questionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Question', 
    required: true 
  },
  // Other answer fields you want to store:
  type: { 
    type: String, 
    enum: ['mcq', 'code'], 
    required: false 
  },
  selectedAnswer: { type: String }, // for MCQ
  codeAnswer: { type: String },     // for code
  isCorrect: { type: Boolean }
}, { _id: false }); // optional to prevent subdocument _id

const answerSchema = new mongoose.Schema({
  sessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Session', 
    required: false
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false
  },
  answers: {
    type: [answerItemSchema],
    required: false
  },
  score: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now },
  timeTaken: { type: Number },
  autoSaved: { type: Boolean, default: false }
});

module.exports = mongoose.model('Answer', answerSchema);
