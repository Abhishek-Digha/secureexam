 
// Additional user-specific functions can be added here
// Most user functionality is already in app.js

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function showExamInstructions() {
  return new Promise((resolve) => {
    const modal = document.getElementById("exam-instructions-modal");
    const startBtn = document.getElementById("exam-start-btn");
    const cancelBtn = document.getElementById("exam-cancel-btn");

    // Just show modal (instructions already in HTML)
    modal.style.display = "flex";

    startBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true); // ✅ Start Exam
    };

    cancelBtn.onclick = () => {
      modal.style.display = "none";
      resolve(false); // ❌ Cancel Exam
    };
  });
}


// Enhanced question navigation
function jumpToQuestion(index) {
    if (index >= 0 && index < questions.length) {
        currentQuestionIndex = index;
        displayQuestion();
    }
}

// Question palette (for better navigation)
function createQuestionPalette() {
    const palette = document.createElement('div');
    palette.id = 'question-palette';
    palette.innerHTML = '<h4>Questions:</h4>';
    
    for (let i = 0; i < questions.length; i++) {
        const btn = document.createElement('button');
        btn.textContent = i + 1;
        btn.onclick = () => jumpToQuestion(i);
        btn.className = 'palette-btn';
        
        if (userAnswers[questions[i].id]) {
            btn.classList.add('answered');
        }
        if (i === currentQuestionIndex) {
            btn.classList.add('current');
        }
        
        palette.appendChild(btn);
    }
    
    return palette;
}

//Prevent cheating attempts
function preventCheating() {
  // Disable right-click context menu everywhere
  document.addEventListener('contextmenu', e => e.preventDefault());

  // Disable copy, cut, paste except inside inputs and textareas
  ['copy', 'cut', 'paste'].forEach(eventType => {
    document.addEventListener(eventType, e => {
      const tag = e.target.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
      }
    });
  });

  // Disable common cheating shortcuts globally except in input/textarea
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName.toLowerCase();
    const isInput = (tag === 'input' || tag === 'textarea');

    if (!isInput) {
      const key = e.key.toUpperCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;  // Ctrl (Win/Linux) OR Cmd (Mac)

      // Block DevTools toggles: Ctrl+Shift+I/C or Cmd+Shift+I/C
      if (ctrlOrCmd && e.shiftKey && (key === 'I' || key === 'C')) {
        e.preventDefault();
        showCustomAlert('This action is not allowed during the exam');
      }

      // Block view source: Ctrl+U or Cmd+U
      if (ctrlOrCmd && key === 'U') {
        e.preventDefault();
        showCustomAlert('This action is not allowed during the exam');
      }

      // Block refresh: Ctrl+R, Cmd+R, F5
      if (ctrlOrCmd && key === 'R' || key === 'F5') {
        e.preventDefault();
        showCustomAlert('This action is not allowed during the exam');
      }

      // Block common clipboard keys outside inputs: Ctrl/Cmd + C/V/X
      if (ctrlOrCmd && ['C', 'V', 'X'].includes(key)) {
        e.preventDefault();
        showCustomAlert('This action is not allowed during the exam');
      }

      // Block F12 key globally (DevTools)
      if (key === 'F12') {
        e.preventDefault();
        showCustomAlert('This action is not allowed during the exam');
      }
    }
  });
}


// Initialize cheating prevention when exam starts
document.addEventListener('DOMContentLoaded', () => {
    preventCheating();
});


// Auto-save functionality
function autoSaveAnswers() {
  setInterval(() => {
    if (currentSession && currentUser && Object.keys(userAnswers).length > 0) {
      const answersArray = Object.entries(userAnswers)
        .filter(([qid]) => qid && qid !== 'undefined')
        .map(([questionId, ans]) => ({
          questionId,
          type: ans.type,
          selectedAnswer: ans.type === 'mcq' ? ans.value : null,
          codeAnswer: ans.type === 'code' ? ans.value : null
        }));

      apiCall('/user/auto-save', 'POST', {
        sessionId: currentSession.id,
        userId: currentUser.id,
        answers: answersArray
      }).catch(err => {
        console.error('Auto-save error:', err);
      });
    }
  });
}



