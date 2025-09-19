let currentPanel = 'questions';

// Show the selected panel and hide others
function showPanel(panelId) {
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.add('hidden');
  });
  document.getElementById(panelId).classList.remove('hidden');
}


function showCustomAlert(message) {
  const modal = document.getElementById("custom-alert");
  const msgBox = document.getElementById("alert-message");
  const okBtn = document.getElementById("alert-ok-btn");

  msgBox.innerText = message;
  modal.style.display = "flex";

  okBtn.onclick = () => {
    modal.style.display = "none";
  };
}

function showCustomConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm");
    const msgBox = document.getElementById("confirm-message");
    const yesBtn = document.getElementById("confirm-yes");
    const noBtn = document.getElementById("confirm-no");

    msgBox.innerText = message;
    modal.style.display = "flex";

    yesBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };

    noBtn.onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };
  });
}



// Functions to show specific panels with loading data
function showQuestions() {
  showPanel('questions-panel');
  loadQuestions();
}

function showSessions() {
  showPanel('sessions-panel');
  loadSessions();
}

function showLiveFeed() {
  showPanel('live-feed-panel');
  loadLiveFeed();
}

function showReports() {
  showPanel('reports-panel');
  loadReports();
}

// Load admin initial data
async function loadAdminData() {
  showQuestions();
  loadQuestionsList();
}

// --------------------------------
// Question Management

document.getElementById('question-form').addEventListener('submit', async e => {
  e.preventDefault();

  const type = document.getElementById('question-type').value;
  const text = document.getElementById('question-text').value.trim();
  const difficulty = 'medium';
  const category = 'general';

  let questionData = { text, type, difficulty, category };

  if (type === 'mcq') {
    questionData.optionA = document.getElementById('optionA').value.trim();
    questionData.optionB = document.getElementById('optionB').value.trim();
    questionData.optionC = document.getElementById('optionC').value.trim();
    questionData.optionD = document.getElementById('optionD').value.trim();
    questionData.correctAnswer = document.getElementById('correctAnswer').value;
  } else if (type === 'code') {
    questionData.codingTemplate = document.getElementById('codingTemplate').value.trim();
  }

  console.log('Creating question with data:', questionData);

  try {
    const response = await apiCall('/admin/questions', 'POST', questionData);
    console.log('Create question response:', response);
    if (response.success) {
      document.getElementById('question-form').reset();
      toggleQuestionFields();
      await loadQuestions();
    } else {
      showCustomAlert('Failed to add question: ' + response.message);
    }
  } catch (error) {
    console.log('Entering catch block due to error');
    showCustomAlert('Failed to add question');
    console.error('Error creating question:', error);
  }
});

async function loadQuestions() {
  try {
    const response = await apiCall('/admin/questions');
    console.log('Loaded questions:', response);
    const questionsList = document.getElementById('questions-list');
    questionsList.innerHTML = '';

    response.questions.forEach(question => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'question-item';
      if (question.type === 'mcq') {
        questionDiv.innerHTML = `
          <h4>${question.text}</h4>
          <p><strong>A:</strong> ${question.optionA}</p>
          <p><strong>B:</strong> ${question.optionB}</p>
          <p><strong>C:</strong> ${question.optionC}</p>
          <p><strong>D:</strong> ${question.optionD}</p>
          <p><strong>Correct Answer:</strong> ${question.correctAnswer}</p>
          <button onclick="deleteQuestion('${question._id}')" class="btn btn-danger">Delete</button>
        `;
      } else if (question.type === 'code') {
        questionDiv.innerHTML = `
          <h4>${question.text}</h4>
          <pre><code>${question.codingTemplate || 'No coding template provided.'}</code></pre>
          <button onclick="deleteQuestion('${question._id}')" class="btn btn-danger">Delete</button>
        `;
      } else {
        questionDiv.innerHTML = `
          <h4>${question.text}</h4>
          <p>Unknown question type</p>
          <button onclick="deleteQuestion('${question._id}')" class="btn btn-danger">Delete</button>
        `;
      }
      questionsList.appendChild(questionDiv);
    });
  } catch (error) {
    console.error('Failed to load questions', error);
  }
}

async function deleteQuestion(questionId) {
   const confirmed = await showCustomConfirm("Are you sure you want to delete this question?");
  if (confirmed) {
    console.log('Deleting question with ID:', questionId);
    try {
      const response = await apiCall(`/admin/questions/${questionId}`, 'DELETE');
      console.log('Delete question response:', response);
      await loadQuestions();
      await loadSessions();
    } catch (err) {
      console.error('Failed to delete question', err);
      showCustomAlert('Failed to delete question');
    }
  }
}

// --------------------------------
// Session Management

// document.getElementById('session-form').addEventListener('submit', async (e) => {
//   e.preventDefault();

//   const selectedQCheckboxes = document.querySelectorAll('input[name="sessionQuestions"]:checked');
//   const selectedQuestions = Array.from(selectedQCheckboxes).map(cb => cb.value);

//   const payload = {
//     name: document.getElementById('session-name').value,
//     startTime: document.getElementById('session-start').value,
//     duration: parseInt(document.getElementById('session-duration').value, 10),
//     questions: selectedQuestions
//   };

//   const res = await fetch(`${API_BASE}/api/sessions`, {
//     method: 'POST', // or PUT depending on your API
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload)
//   });

//   if (res.ok) {
//     alert('Session created/updated successfully!');
//     // Refresh sessions list or reset form as needed
//   } else {
//     alert('Failed to save session');
//   }
// });

document.getElementById('session-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('session-name').value.trim();
  const startTime = document.getElementById('session-start').value;
  const durationStr = document.getElementById('session-duration').value;
  const duration = parseInt(durationStr, 10);

  if (!name || !startTime || isNaN(duration) || duration <= 0) {
    alert('Please fill in all session fields correctly.');
    return;
  }

  const checkedBoxes = document.querySelectorAll('input[name="sessionQuestions"]:checked');
  const selectedQuestions = Array.from(checkedBoxes).map(cb => cb.value);

  const payload = {
    name,
    startTime,
    duration,
    questions: selectedQuestions
  };

  try {
    const res = await fetch(`${API_BASE}/admin/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorBody = await res.json();
      alert(`Failed to create session: ${errorBody.message || res.statusText}`);
      return;
    }

    alert('Session created successfully!');
    // Optionally reset form and reload sessions list
    e.target.reset();
    loadSessions(); // implement or call your existing sessions reload function

  } catch (error) {
    console.error('Error creating session:', error);
    alert('Failed to create session due to network/server error.');
  }
});

// Load questions on DOM ready or session panel displayed
//document.addEventListener('DOMContentLoaded', loadQuestionsList);



async function loadSessions() {
  try {
    const response = await apiCall('/admin/sessions');
    console.log('Loaded sessions:', response);
    const sessionsList = document.getElementById('sessions-list');
    sessionsList.innerHTML = '';

    response.sessions.forEach(session => {
      const sessionDiv = document.createElement('div');
      sessionDiv.className = 'session-item';
      sessionDiv.innerHTML = `
        <h4>${session.name}</h4>
        <p><strong>Session Code:</strong> ${session.code}</p>
        <p><strong>Start Time:</strong> ${new Date(session.startTime).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${session.duration} minutes</p>
        <p><strong>Status:</strong> ${session.status}</p>
        <button id="activate-btn-${session._id}" onclick="activateSession('${session._id}')" class="btn btn-primary">Activate</button>
        <button id="terminate-btn-${session._id}" onclick="terminateSession('${session._id}')" class="btn btn-danger">Terminate</button>
        <button id="delete-btn-${session._id}" onclick="deleteSession('${session._id}')" class="btn btn-danger">Delete</button>
      `;
      sessionsList.appendChild(sessionDiv);
    });
  } catch (error) {
    console.error('Failed to load sessions', error);
  }
}

async function activateSession(sessionId) {
  const activateBtn = document.getElementById(`activate-btn-${sessionId}`);
  if (activateBtn) activateBtn.disabled = true;

  try {
    const response = await apiCall(`/admin/sessions/${sessionId}/activate`, 'POST');
    console.log('Activate session response:', response);
    if (response.success) {
      await loadSessions();
      showCustomAlert("Session activates successfully!");
    } else {
      showCustomAlert('Failed to activate session: ' + (response.message || 'Unknown error'));
    }
  } catch (error) {
    showCustomAlert('Failed to activate session.');
    console.error('Error activating session:', error);
  } finally {
    if (activateBtn) activateBtn.disabled = false;
  }
}

async function terminateSession(sessionId) {
  //if (!confirm('Are you sure you want to terminate this session?')) return;
  const confirmed = await showCustomConfirm("Are you sure you want to terminate this session?");
  if (!confirmed) return;

  const terminateBtn = document.getElementById(`terminate-btn-${sessionId}`);
  if (terminateBtn) terminateBtn.disabled = true;

  try {
    const response = await apiCall(`/admin/sessions/${sessionId}/terminate`, 'POST');
    console.log('Terminate session response:', response);
    if (response.success) {
      socket.emit('terminateSession', sessionId);
      await loadSessions();
      showCustomAlert('Session terminated.');

    } else {
      showCustomAlert('Failed to terminate session: ' + (response.message || 'Unknown error'));
    }
  } catch (error) {
    showCustomAlert('Failed to terminate session.');
    console.error('Error terminating session:', error);
  } finally {
    if (terminateBtn) terminateBtn.disabled = false;
  }
}

async function deleteSession(sessionId) {
  if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) return;

  const deleteBtn = document.getElementById(`delete-btn-${sessionId}`);
  if (deleteBtn) deleteBtn.disabled = true;

  try {
    const response = await apiCall(`/admin/sessions/${sessionId}`, 'DELETE');
    console.log('Delete session response:', response);
    if (response.success) {
      await loadSessions();
      showCustomAlert('Session deleted successfully.');
    } else {
      showCustomAlert('Failed to delete session: ' + (response.message || 'Unknown error'));
    }
  } catch (error) {
    showCustomAlert('Failed to delete session.');
    console.error('Error deleting session:', error);
  } finally {
    if (deleteBtn) deleteBtn.disabled = false;
  }
}

// --------------------------------
// Live Feed Management

function loadLiveFeed() {
  const videoFeeds = document.getElementById('video-feeds');
  videoFeeds.innerHTML = '<p>Waiting for active sessions...</p>';

  socket.on('videoFrame', data => {
    console.log('Received video frame:', data);
    updateVideoFeed(data);
  });
}

// function updateVideoFeed(data) {
//   const videoFeeds = document.getElementById('video-feeds');
//   let feedElement = document.getElementById(`feed-${data.user.id}`);

//   if (!feedElement) {
//     feedElement = document.createElement('div');
//     feedElement.id = `feed-${data.user.id}`;
//     feedElement.className = 'video-feed';
//     feedElement.innerHTML = `
//       <img id="video-${data.user.id}" style="width: 100%; height: 200px; border-radius: 5px;">
//       <div class="user-info">
//         <p><strong>Name:</strong> ${data.user.name}</p>
//         <p><strong>Email:</strong> ${data.user.email}</p>
//         <p><strong>Mobile:</strong> ${data.user.mobile}</p>
//       </div>
//     `;
//     videoFeeds.appendChild(feedElement);
//   }

//   const imgElement = document.getElementById(`video-${data.user.id}`);
//   imgElement.src = data.frame;
// }

// --------------------------------
// Report Management

async function loadReports() {
  try {
    const response = await apiCall('/admin/reports');
    console.log('Loaded reports:', response);
    const reportsList = document.getElementById('reports-list');
    reportsList.innerHTML = '';

    response.reports.forEach(report => {
      const reportDiv = document.createElement('div');
      reportDiv.className = 'report-item';
      reportDiv.innerHTML = `
        <h4>${report.user.name} - ${report.session.name}</h4>
        <p><strong>Email:</strong> ${report.user.email}</p>
        <p><strong>Mobile:</strong> ${report.user.mobile}</p>
        <p><strong>Score:</strong> ${report.score}/${report.totalQuestions}</p>
        <p><strong>Submitted:</strong> ${new Date(report.submittedAt).toLocaleString()}</p>
        <button onclick="downloadReport('${report.id}')" class="btn btn-primary">Download PDF</button>
      `;
      reportsList.appendChild(reportDiv);
    });
  } catch (error) {
    console.error('Failed to load reports', error);
  }
}

async function downloadReport(reportId) {
  try {
    const response = await fetch(`${API_BASE}/admin/reports/${reportId}/pdf`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-report-${reportId}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    showCustomAlert('Failed to download report');
    console.error('Error downloading report:', error);
  }
}

// --------------------------------
// Generic API call helper

async function apiCall(endpoint, method = 'GET', data = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (data) options.body = JSON.stringify(data);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  return await res.json();
}


async function loadQuestionsList() {
  const dropdownList = document.getElementById('dropdown-list');
  try {
    const response = await fetch(`${API_BASE}/admin/questions`);
    const data = await response.json();

    if (!data.success || !Array.isArray(data.questions) || data.questions.length === 0) {
      dropdownList.innerHTML = '<div style="padding:10px;">No questions available</div>';
      return;
    }

    dropdownList.innerHTML = '';

    data.questions.forEach(q => {
      const label = document.createElement('label');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = q._id;
      checkbox.name = 'sessionQuestions';

      const span = document.createElement('span');
      span.textContent = q.text;

      label.appendChild(checkbox);
      label.appendChild(span);

      dropdownList.appendChild(label);
    });

  } catch (error) {
    dropdownList.innerHTML = '<div style="padding:10px; color:red;">Error loading questions</div>';
    console.error('Failed to load questions:', error);
  }
}

// Dropdown button toggle
document.getElementById('dropdown-btn').addEventListener('click', () => {
  const list = document.getElementById('dropdown-list');
  list.classList.toggle('hidden');
});

// Close dropdown if click outside
document.addEventListener('click', (e) => {
  const container = document.querySelector('.dropdown-multiselect');
  const list = document.getElementById('dropdown-list');
  if (!container.contains(e.target)) {
    list.classList.add('hidden');
  }
});

// Initialize load on DOM ready or when showing session panel
document.addEventListener('DOMContentLoaded', loadQuestionsList);



// --------------------------------
// Initialize admin dashboard on page load
//loadAdminData();

socket.emit('adminJoin');

// Listen for user join notifications to update UI live
socket.on('user_joined_session', (data) => {
  console.log('User joined session:', data);
  // TODO: Add UI code to display user joined in your live session panel
  showCustomAlert(`User ${data.userName} joined session ${data.sessionId}`);
  // Or update participant list DOM dynamically
});

// Listen for video frames and update video feeds
// socket.on('videoFrame', (data) => {
//    console.log('Admin client received videoFrame for user:', data.user.id);
//   updateVideoFeed(data);
// });


socket.on('videoFrame', (data) => {
   console.log('Admin client received videoFrame update user feed for user:', data.user.id);
  updateUserFeed(data);
});

socket.on('user_typed_log', (data) => {
   console.log('Admin client received videoFrame/typed log for user:', data.user.id);
  updateUserFeed(data);
});

function updateUserFeed(data) {
  const videoFeeds = document.getElementById('video-feeds');
  let feedElement = document.getElementById(`feed-${data.user.id}`);

  if (!feedElement) {
    feedElement = document.createElement('div');
    feedElement.id = `feed-${data.user.id}`;
    feedElement.className = 'video-feed';
    feedElement.innerHTML = `
      <div class="user-info">
        <p><strong>Name:</strong> ${data.user.name}</p>
        <p><strong>Email:</strong> ${data.user.email}</p>
        <p><strong>Mobile:</strong> ${data.user.mobile}</p>
      </div>
      <img id="video-${data.user.id}" style="width: 100%; height: 200px; border-radius: 5px; display:none;">
      <div id="typed-text-${data.user.id}" class="typed-text-log" style="background:#eee; padding:10px; margin-top:5px; white-space: pre-wrap;"></div>
    `;
    videoFeeds.appendChild(feedElement);
  }

  // Update video if present
  if (data.frame) {
    const imgElement = document.getElementById(`video-${data.user.id}`);
    imgElement.src = data.frame;
    imgElement.style.display = 'block';
  }

  // Update typed text log if present
  if (data.typedText !== undefined) {
    const typedTextDiv = document.getElementById(`typed-text-${data.user.id}`);
    typedTextDiv.textContent = data.typedText;
  }
}