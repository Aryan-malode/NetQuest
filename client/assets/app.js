/* NetQuest browser interface. The server decides the game state and scores. */
const app = document.getElementById("app");
let role = "";
let sessionId = "";
let playerName = "";
let lastState = null;
let polling = false;
let flashMessage = "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function showFlash() {
  if (!flashMessage) return "";
  return `<div class="notice" role="status">${escapeHtml(flashMessage)}</div>`;
}

function renderWelcome() {
  app.innerHTML = `
    <section class="welcome-grid">
      <div class="intro-copy">
        <div class="eyebrow"><span class="eyebrow-mark"></span> A small classroom challenge</div>
        <h1>Good questions.<br><span>Quick thinking.</span></h1>
        <p>One teacher runs the room. Students join from their own devices, answer together and check the scoreboard after each question.</p>
        <div class="feature-list">
          <div><span class="feature-icon">↔</span><span>Live client–server communication</span></div>
          <div><span class="feature-icon">✓</span><span>Teacher-controlled questions</span></div>
          <div><span class="feature-icon">★</span><span>Simple score tracking</span></div>
        </div>
      </div>
      <section class="join-card">
        <div class="card-icon">NQ</div>
        <p class="card-overline">WELCOME TO NETQUEST</p>
        <h2>How are you joining?</h2>
        <p class="muted">Choose the view that matches your role.</p>
        ${showFlash()}
        <div class="role-options">
          <button class="role-option" type="button" data-action="choose-teacher">
            <span class="role-icon">▤</span><span class="role-text"><strong>I'm the teacher</strong><small>Create a room and control the quiz</small></span><span class="role-arrow">→</span>
          </button>
          <button class="role-option" type="button" data-action="choose-student">
            <span class="role-icon student-icon">↗</span><span class="role-text"><strong>I'm a student</strong><small>Join a room and answer questions</small></span><span class="role-arrow">→</span>
          </button>
        </div>
        <p class="form-footnote">No accounts or installation required on student devices.</p>
      </section>
    </section>`;
  flashMessage = "";
}

function renderJoinForm(joinRole, message = "") {
  role = joinRole;
  const teacher = joinRole === "teacher";
  app.innerHTML = `
    <section class="form-page">
      <button class="back-link" type="button" data-action="back">← Back</button>
      <div class="form-card">
        <div class="card-icon">${teacher ? "T" : "S"}</div>
        <p class="card-overline">${teacher ? "TEACHER ACCESS" : "STUDENT ACCESS"}</p>
        <h1>${teacher ? "Create your classroom" : "Join the quiz"}</h1>
        <p class="muted">${teacher ? "Start a room, then share the room code with your class." : "Enter your name and the room code shared by your teacher."}</p>
        ${message ? `<div class="notice error-notice">${escapeHtml(message)}</div>` : ""}
        ${showFlash()}
        <form id="join-form" class="join-form">
          <label for="player-name">${teacher ? "Teacher name" : "Your name"}</label>
          <input id="player-name" name="name" type="text" maxlength="24" placeholder="e.g. Alex" autocomplete="name" required>
          ${teacher ? "" : `<label for="room-code">Room code</label><input id="room-code" name="room_code" type="text" value="NETQUEST" maxlength="16" required>`}
          <button class="primary-btn" type="submit">${teacher ? "Create room" : "Join classroom"}<span>→</span></button>
        </form>
        <p class="form-footnote">${teacher ? "Only one teacher can host a room at a time." : "Your teacher must create the room before you join."}</p>
      </div>
    </section>`;
  flashMessage = "";
}

function renderPlayerList(state) {
  if (!state.students.length) {
    return `<div class="empty-list"><span class="empty-icon">＋</span><p>No students yet</p><small>They'll appear here once they join.</small></div>`;
  }
  return `<div class="player-list">${state.students.map((student, index) => `
    <div class="player-row"><span class="avatar">${escapeHtml(student.name.slice(0, 1).toUpperCase())}</span><span class="player-name">${escapeHtml(student.name)}</span><span class="player-score">${student.score} <small>pts</small></span></div>`).join("")}</div>`;
}

function renderLeaderboard(state) {
  if (!state.leaderboard.length) return `<p class="muted">No scores yet.</p>`;
  return `<div class="score-list">${state.leaderboard.map((player, index) => `
    <div class="score-row ${index === 0 ? "top-score" : ""}"><span class="rank">${index === 0 ? "★" : index + 1}</span><span class="score-name">${escapeHtml(player.name)}<small>${player.correct} correct</small></span><strong>${player.score}<small>pts</small></strong></div>`).join("")}</div>`;
}

function renderResponses(state) {
  if (!state.responses.length) return `<p class="muted small-copy">No answers submitted for this question yet.</p>`;
  return `<div class="response-list">${state.responses.map((answer) => {
    let marker = "Submitted";
    let className = "response-mark";
    if (state.revealed) {
      marker = answer.correct ? "Correct · +100" : "Not quite · +0";
      className += answer.correct ? " right" : " wrong";
    }
    return `<div class="response-row"><span>${escapeHtml(answer.name)}</span><span class="${className}">${marker}</span></div>`;
  }).join("")}</div>`;
}

function renderTeacher(state) {
  const commonHeader = `<div class="dashboard-head"><div><div class="eyebrow">TEACHER VIEW</div><h1>Classroom control</h1><p class="muted">Welcome, ${escapeHtml(state.you.name)}. You're running the room.</p></div><div class="room-code-box"><span>ROOM CODE</span><strong>${state.room_code}</strong><small>Share this with students</small></div></div>`;
  let mainContent = "";

  if (state.status === "waiting") {
    mainContent = `
      <div class="dashboard-grid">
        <section class="panel main-panel">
          <div class="panel-heading"><div><p class="card-overline">READY WHEN YOU ARE</p><h2>Students are joining</h2></div><span class="count-badge">${state.student_count}/8 joined</span></div>
          <p class="muted">Keep this page open. When everyone is in, start the quiz and the first question will appear on student screens.</p>
          <div class="waiting-banner"><span class="waiting-pulse"></span><div><strong>Room is open</strong><p>Students need the room code <b>${state.room_code}</b>.</p></div></div>
          <button class="primary-btn" type="button" data-action="start-quiz" ${state.student_count === 0 ? "disabled" : ""}>Start quiz <span>→</span></button>
        </section>
        <aside class="panel side-panel"><div class="panel-heading"><h3>Who's here</h3><span class="count-badge">${state.student_count}</span></div>${renderPlayerList(state)}</aside>
      </div>`;
  } else if (state.status === "active" && state.question) {
    const q = state.question;
    const choices = q.options.map((option, i) => `<div class="teacher-option ${state.revealed && i === q.correct_index ? "correct-option" : ""}"><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${escapeHtml(option)}</span>${state.revealed && i === q.correct_index ? `<span class="correct-tag">Correct</span>` : ""}</div>`).join("");
    const revealBox = state.revealed ? `<div class="explanation-box"><strong>Correct answer: ${escapeHtml(q.options[q.correct_index])}</strong><p>${escapeHtml(q.explanation)}</p></div>` : `<div class="teacher-hint">The correct answer is available in the teacher view only. Reveal it when you're ready to discuss it with the class.</div>`;
    mainContent = `
      <div class="dashboard-grid">
        <section class="panel main-panel">
          <div class="panel-heading"><div><p class="card-overline">QUESTION ${String(q.number).padStart(2, "0")} OF ${q.total}</p><h2>Over to the class</h2></div><span class="count-badge">${state.answered_count}/${state.student_count} answered</span></div>
          <div class="question-display"><p>${escapeHtml(q.text)}</p><div class="teacher-options">${choices}</div></div>
          ${revealBox}
          <div class="button-row">
            ${state.revealed ? `<button class="primary-btn" type="button" data-action="next-question">${q.number === q.total ? "Finish quiz" : "Next question"}<span>→</span></button>` : `<button class="primary-btn" type="button" data-action="reveal-answer">Reveal answer <span>✓</span></button>`}
          </div>
          <div class="response-section"><div class="subheading"><h3>Responses</h3><span>${state.answered_count} received</span></div>${renderResponses(state)}</div>
        </section>
        <aside class="panel side-panel"><div class="panel-heading"><h3>Scoreboard</h3><span class="live-label"><i></i> LIVE</span></div>${renderLeaderboard(state)}<div class="cn-note"><strong>Networking note</strong><p>Each browser requests the latest room state from the Python server over HTTP/TCP.</p></div></aside>
      </div>`;
  } else {
    mainContent = `
      <div class="dashboard-grid">
        <section class="panel main-panel finish-panel"><div class="finish-icon">★</div><p class="card-overline">QUIZ COMPLETE</p><h2>That's the last question.</h2><p class="muted">Review the final scores with the class. Reset the room to run another round.</p>${renderLeaderboard(state)}<button class="primary-btn" type="button" data-action="reset-round">Start a new round <span>↻</span></button></section>
        <aside class="panel side-panel"><div class="panel-heading"><h3>Thanks for playing</h3></div><p class="muted">Students stay connected when you reset, so there's no need for everyone to rejoin.</p><div class="cn-note"><strong>Demo tip</strong><p>Explain how the server stores one shared quiz state for every connected browser.</p></div></aside>
      </div>`;
  }
  app.innerHTML = `${commonHeader}${showFlash()}${mainContent}`;
  flashMessage = "";
}

function renderStudent(state) {
  const header = `<div class="dashboard-head"><div><div class="eyebrow">STUDENT VIEW</div><h1>Hi, ${escapeHtml(state.you.name)}.</h1><p class="muted">You're in ${escapeHtml(state.teacher_name)}'s classroom.</p></div><div class="student-stat"><span>YOUR SCORE</span><strong>${state.you.score}</strong><small>points so far</small></div></div>`;
  let content = "";
  if (state.status === "waiting") {
    content = `<div class="dashboard-grid"><section class="panel main-panel student-wait"><span class="large-wait-icon">◷</span><p class="card-overline">YOU'RE ON THE LIST</p><h2>Waiting for the teacher</h2><p class="muted">The quiz will begin here as soon as your teacher starts it. Keep this page open.</p><div class="waiting-banner"><span class="waiting-pulse"></span><div><strong>Connected to room ${state.room_code}</strong><p>Your connection to the server is active.</p></div></div></section><aside class="panel side-panel"><div class="panel-heading"><h3>Classmates</h3><span class="count-badge">${state.student_count}</span></div>${renderPlayerList(state)}</aside></div>`;
  } else if (state.status === "active" && state.question) {
    const q = state.question;
    const alreadyAnswered = state.your_answer !== null;
    const options = q.options.map((option, i) => {
      let className = "student-option";
      if (alreadyAnswered && state.your_answer === i) className += " selected-option";
      if (state.revealed && i === q.correct_index) className += " correct-option";
      const disabled = alreadyAnswered || state.revealed;
      return `<button type="button" class="${className}" data-action="submit-answer" data-choice="${i}" data-question="${q.index}" ${disabled ? "disabled" : ""}><span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${escapeHtml(option)}</span>${state.revealed && i === q.correct_index ? `<span class="answer-check">✓</span>` : ""}</button>`;
    }).join("");
    let feedback = "Choose the option you think is right. You can submit one answer per question.";
    if (alreadyAnswered && !state.revealed) feedback = "Answer submitted. You're locked in — wait for the teacher to reveal the answer.";
    if (state.revealed) feedback = state.your_answer === q.correct_index ? "Nice one — that's correct. +100 points." : alreadyAnswered ? "Not this time. Check the explanation and try the next one." : "The answer has been revealed. Get ready for the next question.";
    content = `<div class="dashboard-grid"><section class="panel main-panel student-question"><div class="panel-heading"><div><p class="card-overline">QUESTION ${String(q.number).padStart(2, "0")} OF ${q.total}</p><h2>What's your answer?</h2></div><span class="count-badge">${state.you.correct} correct</span></div><div class="student-question-text">${escapeHtml(q.text)}</div><div class="student-options">${options}</div><div class="answer-feedback ${state.revealed ? "feedback-revealed" : ""}">${escapeHtml(feedback)}</div>${state.revealed ? `<div class="explanation-box"><strong>Answer: ${escapeHtml(q.options[q.correct_index])}</strong><p>${escapeHtml(q.explanation)}</p></div>` : ""}<div class="response-counter">${state.answered_count} of ${state.student_count} students have answered.</div></section><aside class="panel side-panel"><div class="panel-heading"><h3>Live scoreboard</h3><span class="live-label"><i></i> LIVE</span></div>${renderLeaderboard(state)}<div class="cn-note"><strong>Connected</strong><p>Answers are sent to the teacher's quiz server using HTTP over TCP.</p></div></aside></div>`;
  } else {
    content = `<div class="dashboard-grid"><section class="panel main-panel finish-panel"><div class="finish-icon">★</div><p class="card-overline">QUIZ COMPLETE</p><h2>Well played, ${escapeHtml(state.you.name)}.</h2><p class="muted">Here's how the class finished.</p>${renderLeaderboard(state)}<div class="waiting-banner"><span class="waiting-pulse"></span><div><strong>Waiting for the teacher</strong><p>The teacher can reset the room for another round.</p></div></div></section><aside class="panel side-panel"><div class="panel-heading"><h3>Your result</h3></div><div class="big-score">${state.you.score}<small>points</small></div><p class="muted">${state.you.correct} correct answers out of ${state.total_questions} questions.</p></aside></div>`;
  }
  app.innerHTML = `${header}${showFlash()}${content}`;
  flashMessage = "";
}

function renderState() {
  if (!lastState) return;
  if (role === "teacher") renderTeacher(lastState);
  else renderStudent(lastState);
}

async function startPolling() {
  if (polling) return;
  polling = true;
  while (sessionId) {
    try {
      lastState = await api(`/api/state?role=${encodeURIComponent(role)}&id=${encodeURIComponent(sessionId)}`);
      renderState();
    } catch (error) {
      if (error.status === 401) {
        sessionId = "";
        role = "";
        lastState = null;
        flashMessage = "Your session ended. Join the room again.";
        renderWelcome();
        break;
      }
      flashMessage = error.message;
      renderState();
    }
    await sleep(900);
  }
  polling = false;
}

async function submitJoin(form) {
  const values = new FormData(form);
  const name = values.get("name");
  try {
    let result;
    if (role === "teacher") {
      result = await api("/api/teacher/join", { method: "POST", body: { name } });
      sessionId = result.teacher_id;
    } else {
      result = await api("/api/student/join", {
        method: "POST",
        body: { name, room_code: values.get("room_code") },
      });
      sessionId = result.player_id;
    }
    playerName = result.name;
    flashMessage = `Welcome, ${playerName}.`;
    startPolling();
  } catch (error) {
    renderJoinForm(role, error.message);
  }
}

async function performAction(action, button) {
  try {
    if (action === "start-quiz") {
      await api("/api/teacher/start", { method: "POST", body: { teacher_id: sessionId } });
      flashMessage = "The quiz has started.";
    } else if (action === "reveal-answer") {
      await api("/api/teacher/reveal", { method: "POST", body: { teacher_id: sessionId } });
      flashMessage = "Answer revealed to the class.";
    } else if (action === "next-question") {
      await api("/api/teacher/next", { method: "POST", body: { teacher_id: sessionId } });
      flashMessage = "Question updated.";
    } else if (action === "reset-round") {
      await api("/api/teacher/reset", { method: "POST", body: { teacher_id: sessionId } });
      flashMessage = "Room reset. Students can stay connected.";
    } else if (action === "submit-answer") {
      button.disabled = true;
      await api("/api/student/answer", {
        method: "POST",
        body: {
          player_id: sessionId,
          question_index: Number(button.dataset.question),
          choice_index: Number(button.dataset.choice),
        },
      });
      flashMessage = "Answer submitted.";
    }
    lastState = await api(`/api/state?role=${encodeURIComponent(role)}&id=${encodeURIComponent(sessionId)}`);
    renderState();
  } catch (error) {
    flashMessage = error.message;
    if (lastState) renderState();
  }
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "choose-teacher") renderJoinForm("teacher");
  else if (action === "choose-student") renderJoinForm("student");
  else if (action === "back") {
    role = "";
    renderWelcome();
  } else if (action === "start-quiz" || action === "reveal-answer" || action === "next-question" || action === "reset-round" || action === "submit-answer") {
    performAction(action, button);
  }
});

app.addEventListener("submit", (event) => {
  if (event.target.id !== "join-form") return;
  event.preventDefault();
  submitJoin(event.target);
});

renderWelcome();
