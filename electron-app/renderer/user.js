 
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

// Prevent cheating attempts
//function preventCheating() {
    // Disable right-click
//     document.addEventListener('contextmenu', (e) => {
//     e.preventDefault();
//    });
    
//     // // Disable common keyboard shortcuts
//     document.addEventListener('keydown', (e) => {
//   const targetTag = e.target.tagName.toLowerCase();
//   const isInputField = targetTag === 'input' || targetTag === 'textarea';

//   if (!isInputField) {
//     if (
//       e.key === 'F12' ||
//       (e.ctrlKey && e.shiftKey && e.key === 'I') ||
//       (e.ctrlKey && e.shiftKey && e.key === 'C') ||
//       (e.ctrlKey && e.key === 'u') ||
//       (e.ctrlKey && e.key === 'r') ||
//       e.key === 'F5'
//     ) {
//       e.preventDefault();
//       showCustomAlert('This action is not allowed during the exam');
//     }
//   }
// });

//     // Detect tab switch
//      document.addEventListener('visibilitychange', () => {
//          if (document.hidden && currentSession) {
//              showCustomAlert('Warning: Do not switch tabs during the exam!');
//              // You could implement strike system here
//          }
//     });
// }

// // Initialize cheating prevention when exam starts
// document.addEventListener('DOMContentLoaded', () => {
//     preventCheating();
//});


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



