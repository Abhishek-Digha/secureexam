 
const API_BASE = 'https://secureexam.onrender.com/api';
//const socket = io('http://localhost:5000');
const socket = io("https://secureexam.onrender.com", {
  transports: ["websocket", "polling"]
});
let currentUser = null;
let currentSession = null;
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let examTimer = null;
let stream = null;

// Screen navigation functions
function showMainScreen() {
    hideAllScreens();
    document.getElementById('login-screen').classList.add('active');
}

function showAdminLogin() {
    hideAllScreens();
   
    //electronAPI.disableSecureMode();
  // show admin dashboard...
    document.getElementById('admin-login-screen').classList.add('active');
}

function showUserLogin() {
    hideAllScreens();
    document.getElementById('user-login-screen').classList.add('active');
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

function logout() {
    currentUser = null;
    currentSession = null;
    electronAPI.disableSecureMode();
    showUserLogin();
}

// API helper functions
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(API_BASE + endpoint, options);
    return await response.json();
}

// Event listeners
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    
    try {
        const response = await apiCall('/auth/admin-login', 'POST', { username, password });
        if (response.success) {
            currentUser = response.user;
            hideAllScreens();
            document.getElementById('admin-dashboard').classList.add('active');
            loadAdminData();
        } else {
            showCustomAlert('Invalid credentials');
        }
    } catch (error) {
        showCustomAlert('Login failed');
    }
});

document.getElementById('user-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const mobile = document.getElementById('user-mobile').value;
    const sessionCode = document.getElementById('session-code').value;
    
    try {
        const response = await apiCall('/auth/user-join', 'POST', { name, email, mobile, sessionCode });
        if (response.success) {
            currentUser = response.user;
            currentSession = response.session;

            const confirmed = await showExamInstructions();
            if(confirmed)
            await startExam();
            
        } else {
            showCustomAlert('Invalid session code or session not found');
        }
    } catch (error) {
        showCustomAlert('Failed to join session');
    }
});

async function startExam() {
  await electronAPI.enableSecureMode();

  hideAllScreens();
  document.getElementById('exam-screen').classList.add('active');

  // Start camera for live feed
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    document.getElementById('user-camera').srcObject = stream;

    // Send join session event (added room join on server side)
    socket.emit('joinSession', { sessionId: currentSession.id, user: currentUser });

    // Add listener for forced session termination from server
    socket.on('session_terminated', (data) => {
      if (data.sessionId === currentSession.id) {
        showCustomAlert('Your exam session was terminated by the administrator.');
        // Clean up user side and stop exam
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        socket.disconnect();
        //window.location.href = '/session-terminated.html'; // Or custom cleanup
      }
    });

    // Setup video streaming frames
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('user-camera');

      // --- Add here: Start sending video frames every 1 second ---
    setInterval(() => {
      if (!stream) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const video = document.getElementById('user-camera');
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const frameData = canvas.toDataURL('image/jpeg', 0.5);
        socket.emit('videoFrame', { sessionId: currentSession.id, user: currentUser, frame: frameData });
      }
    }, 1000);

    // --- Add here: Track user input and emit typed text logs every 5 seconds ---
    const inputElement = document.getElementById('user-text-input'); // Replace as needed
    let lastTypedValue = '';
    setInterval(() => {
      if (!inputElement) return;
      const currentValue = inputElement.value || '';
      if (currentValue !== lastTypedValue) {
        lastTypedValue = currentValue;
        socket.emit('userTypedLog', {
          sessionId: currentSession.id,
          user: currentUser,
          typedText: currentValue,
          timestamp: new Date().toISOString()
        });
      }
    }, 5000);

  } catch (error) {
    showCustomAlert('Camera access required for exam');
    return;
  }

  // Load questions
  const response = await apiCall(`/user/questions/${currentSession.id}`);
  questions = response.questions;

  // Start timer
  startExamTimer(currentSession.duration);

  // Display first question
  displayQuestion();
}


function displayQuestion() {
  if (currentQuestionIndex >= questions.length) return;

  const question = questions[currentQuestionIndex];

  // Use <pre> to preserve whitespace and line breaks in question text
  document.getElementById('current-question').innerHTML = `
    <h4>Question ${currentQuestionIndex + 1} of ${questions.length}</h4>
    <pre style="white-space: pre-wrap; font-family: monospace; background: #5a4dc6ff; padding: 8px; border-radius: 4px;">
${question.text}
    </pre>
  `;

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  if (question.type === 'mcq') {
    ['A', 'B', 'C', 'D'].forEach(option => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'option';
      optionDiv.innerHTML = `<strong>${option}.</strong> ${question['option' + option]}`;
      optionDiv.onclick = () => selectOption(question._id.toString(), option);

      // Highlight selected option
      if (
        userAnswers[question._id.toString()]?.type === 'mcq' &&
        userAnswers[question._id.toString()]?.value === option
      ) {
        optionDiv.classList.add('selected');
      }

      optionsContainer.appendChild(optionDiv);
    });

    // Hide code editor container if exists
    const codeEditorContainer = document.getElementById('code-editor-container');
    if (codeEditorContainer) codeEditorContainer.style.display = 'none';

  } else if (question.type === 'code') {
  optionsContainer.innerHTML = '';

  const instructionDiv = document.createElement('div');
  instructionDiv.style.background = '#4a68afff';
  instructionDiv.style.borderLeft = '4px solid #007bff';
  instructionDiv.style.padding = '12px';
  instructionDiv.style.marginBottom = '12px';
  instructionDiv.style.borderRadius = '5px';
  instructionDiv.innerHTML = `
    <strong>Instructions / Starter code:</strong>
    <pre style="white-space:pre-wrap; margin-top:6px;">${question.codingTemplate || 'No starter code or instructions provided.'}</pre>
  `;

  const textarea = document.createElement('textarea');
  textarea.id = `code-editor-${question._id}`;
  textarea.rows = 12;
  textarea.cols = 100;
  textarea.style.width = '100%';
  textarea.style.minHeight = '180px';
  textarea.style.fontFamily = "'Courier New', Courier, monospace";
  textarea.style.fontSize = '15px';
  textarea.style.border = '2px solid #007bff';
  textarea.style.borderRadius = '6px';
  textarea.style.marginBottom = '10px';
  textarea.style.background = '#f9faff';
  textarea.autocomplete = 'off';

  textarea.value =
    userAnswers[question._id]?.type === 'code'
      ? userAnswers[question._id].value
      : '';

  // Update local answers only
  textarea.oninput = e => {
    userAnswers[question._id] = {
      type: 'code',
      value: e.target.value,
    };
    //debouncedSave(question._id, userAnswers[question._id]);
  };

  optionsContainer.appendChild(instructionDiv);
  optionsContainer.appendChild(textarea);
}

}

function saveCurrentAnswer() {
  const question = questions[currentQuestionIndex];
  if (!question) return;

  if (question.type === 'code') {
    const codeEditor = document.getElementById('code-editor');
    if (codeEditor) {
      userAnswers[question._id.toString()] = {
        type: 'code',
        value: codeEditor.value
      };
      saveSingleAnswer(question._id.toString(), userAnswers[question._id.toString()]);
    }
  } else if (question.type === 'mcq') {
    const qid = question._id.toString();
    if (userAnswers[qid]) {
      saveSingleAnswer(qid, userAnswers[qid]);
    }
  }
}


function onCodeChanged(questionId, codeValue) {
  userAnswers[questionId] = { type: 'code', value: codeValue };
  //saveSingleAnswer(questionId, userAnswers[questionId]);
}


// function selectOption(option) {
//   const questionId = questions[currentQuestionIndex]._id.toString(); // use _id
//   userAnswers[questionId] = { type: 'mcq', value: option };
//   saveSingleAnswer(questionId, userAnswers[questionId]);
// }

function selectOption(questionId, option) {
    userAnswers[questionId] = { type: 'mcq', value: option };
    //saveSingleAnswer(questionId, userAnswers[questionId]);

    // Update UI highlighting immediately
    displayQuestion();
}


// Use debounce(fn, delay) utility as mentioned before for code autosave

function saveSingleAnswer(questionId, answer) {
  // Defensive, but do NOT block UI if missing data
  if (!currentSession || !currentUser) {
    console.error('No active session or user for autosave');
    return;
  }
  const type = answer.type || 'unknown';
  if (type !== 'mcq' && type !== 'code') {
    console.error('Answer has no valid type:', answer);
    return; // Only valid types sent
  }
  
  // Log only for debug/development
  // console.log('Saving answer:', { questionId, answer });

  // Asynchronously call API; do not block UI (debounced for code)
  apiCall('/user/auto-save', 'POST', {
    sessionId: currentSession.id,
    userId: currentUser.id,
    answers: [{
      questionId,
      type,
      selectedAnswer: type === 'mcq' ? answer.value : null,
      codeAnswer: type === 'code' ? answer.value : null
    }]
  }).catch(err => {
    // Log errors; do not interrupt typing/UI flow
    console.error('Auto-save failed:', err);
  });
}



/**
 * Creates a debounced version of the provided function that delays invoking
 * it until after delay milliseconds have elapsed since the last time it was invoked.
 * Useful for preventing excessive function calls (e.g., fast input events).
 * 
 * @param {Function} fn - The function to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {Function} - Debounced function.
 */
function debounce(fn, delay) {
  let timerId = null;
  return function(...args) {
    // Clear previous timer if any
    if (timerId) clearTimeout(timerId);

    // Set a new timer to invoke fn after delay
    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, delay);
  };
}

function nextQuestion() {
  //saveCurrentAnswer();
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    displayQuestion();
  }
}

function previousQuestion() {
  //saveCurrentAnswer();
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayQuestion();
  }
}

function startExamTimer(duration) {
    let timeLeft = duration * 60; // Convert to seconds
    
    examTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('exam-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(examTimer);
            autoSubmitExam();  // Call submitExam on timeout
            // Emit to server to terminate the session
            socket.emit('examTimeExpired', currentSession.id);
        }
        timeLeft--;
    }, 1000);
}


async function submitExam() {
  if (examTimer) clearInterval(examTimer);

  // Save current answer before submitting
  //saveCurrentAnswer();

  if (confirm('Are you sure you want to submit the exam?')) {
    try {
      await apiCall('/user/submit-exam', 'POST', {
        sessionId: currentSession.id,
        userId: currentUser.id,
        // Convert userAnswers object to array for backend
        answers: Object.entries(userAnswers).map(([questionId, ans]) => ({
          questionId,
          type: ans.type,
          selectedAnswer: ans.type === 'mcq' ? ans.value : null,
          codeAnswer: ans.type === 'code' ? ans.value : null
        }))
      });

      // Stop camera stream if running
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      showCustomAlert('Exam submitted successfully!');
      await electronAPI.disableSecureMode();
      showUserLogin();
      electronAPI.quitApp();

    } catch (error) {
      showCustomAlert('Failed to submit exam');
      console.error(error);
      showUserLogin();
      electronAPI.quitApp();
    }
  }
}

async function autoSubmitExam() {
  if (examTimer) clearInterval(examTimer); 
    try {
      await apiCall('/user/submit-exam', 'POST', {
        sessionId: currentSession.id,
        userId: currentUser.id,
        // Convert userAnswers object to array for backend
        answers: Object.entries(userAnswers).map(([questionId, ans]) => ({
          questionId,
          type: ans.type,
          selectedAnswer: ans.type === 'mcq' ? ans.value : null,
          codeAnswer: ans.type === 'code' ? ans.value : null
        }))
      });

      // Stop camera stream if running
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      showCustomAlert('Exam submitted successfully!');
      await electronAPI.disableSecureMode();
      showUserLogin();
      electronAPI.quitApp();

    } catch (error) {
      showCustomAlert('Failed to submit exam');
      console.error(error);
      showUserLogin();
      electronAPI.quitApp();
    }
  }



// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('examTerminated', () => {
    showUserLogin();
    showCustomAlert('Exam has been terminated by administrator (Exam Timeout or Unfair means during exam)');
    //electronAPI.quitApp();
});

socket.on('session_terminated', (data) => {
    if (data.sessionId === currentSession.id) {
      showUserLogin();
      showCustomAlert('Your exam session has been terminated by the administrator.');
  // Additional cleanup: stop timers, disconnect socket, redirect, etc.
    }
});