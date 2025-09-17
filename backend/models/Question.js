const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },

  type: { 
    type: String, 
    enum: ['mcq', 'code'], 
    default: 'mcq', 
    required: true
  },

  // MCQ options - required only for MCQ type
  optionA: { 
    type: String,
    required: function() { return this.type === 'mcq'; }
  },
  optionB: { 
    type: String,
    required: function() { return this.type === 'mcq'; }
  },
  optionC: { 
    type: String,
    required: function() { return this.type === 'mcq'; }
  },
  optionD: { 
    type: String,
    required: function() { return this.type === 'mcq'; }
  },
  correctAnswer: { 
    type: String, 
    enum: ['A', 'B', 'C', 'D'], 
    required: function() { return this.type === 'mcq'; }
  },

  // Coding question template, required for code type
  codingTemplate: {
    type: String,
    required: function() { return this.type === 'code'; },
    default: ''
  },

  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'], 
    default: 'medium' 
  },
  category: { 
    type: String, 
    default: 'general' 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Question', questionSchema);
