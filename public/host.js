const socket = io();
const tv = document.getElementById("tv");
let state = null;
let timerInterval = null;

socket.emit("host:join");
socket.on("hostState", (next) => {
  state = next;
  render();
});

document.getElementById("tvReset")?.addEventListener("click", () => {
  if (confirm("Reset the game back to the lobby?")) socket.emit("host:reset");
});

function render() {
  if (!state) return;
  stopTimerInterval();
  if (state.phase === "lobby") return renderLobby();
  if (state.phase === "drawing") return renderDrawing();
  if (state.phase === "revealIntro") return renderRevealIntro();
  if (state.phase === "showcase") return renderShowcase();
  if (state.phase === "voting") return renderVoting();
  if (state.phase === "scoring") return renderScoring();
  if (state.phase === "final") return renderFinal();
}

function renderLobby() {
  const ready = state.players.filter((player) => player.ready).length;
  tv.innerHTML = `
    <section class="tv-screen tv-lobby">
      <div>
        <div class="tv-kicker">Emoji Showdown</div>
        <h1>Join the game</h1>
        <div class="tv-url">${escapeHtml(state.joinUrl || location.origin)}</div>
      </div>
      <div class="tv-lobby-flourish" aria-hidden="true">
        <span>✨</span><span>💥</span><span>👀</span><span>🎂</span><span>🧠</span>
      </div>
      <div class="tv-roster">
        <div class="tv-progress">${ready}/${state.players.length} ready</div>
        <div class="tv-player-grid">
          ${state.players.map((player) => `<div class="tv-player ${player.ready ? "ready" : ""}"><strong>${escapeHtml(player.name)}</strong><span>${player.ready ? "ready" : "..."}</span></div>`).join("") || `<div class="tv-player"><strong>Waiting for artists</strong></div>`}
        </div>
      </div>
    </section>
  `;
}

function renderDrawing() {
  const prompt = state.currentPrompt;
  const submitted = state.participants.filter((player) => player.submitted).length;
  tv.innerHTML = `
    <section class="tv-screen tv-prompt">
      <div class="tv-kicker">Prompt ${prompt.index + 1} of 3</div>
      <h1>${escapeHtml(prompt.text)}</h1>
      <div class="tv-provided">${prompt.provided.map((emoji) => `<span>${emoji}</span>`).join("")}</div>
      <div class="tv-prompt-spark" aria-hidden="true"></div>
      <div class="tv-timer" id="tvTimer">--:--</div>
      <div class="tv-progress">${submitted}/${state.participants.length} submitted</div>
    </section>
  `;
  startTimerInterval();
}

function renderRevealIntro() {
  const prompt = state.revealPrompt;
  tv.innerHTML = `
    <section class="tv-screen tv-stinger">
      <div class="tv-kicker">Gallery ${prompt.index + 1} of 3</div>
      <h1>${escapeHtml(prompt.text)}</h1>
      <div class="tv-provided">${prompt.provided.map((emoji) => `<span>${emoji}</span>`).join("")}</div>
      <div class="tv-progress">Eyes on the TV</div>
    </section>
  `;
}

function renderShowcase() {
  const prompt = state.revealPrompt;
  const submissions = state.submissions || [];
  const current = submissions[state.showcaseIndex % Math.max(1, submissions.length)];
  tv.innerHTML = `
    <section class="tv-screen tv-reveal tv-showcase">
      <div class="tv-kicker">Masterpiece ${Math.min(state.showcaseIndex + 1, submissions.length)} of ${submissions.length}</div>
      <h1>${escapeHtml(prompt.text)}</h1>
      <div class="tv-art-stage" id="tvArt"></div>
      <div class="tv-progress">Anonymous artist</div>
    </section>
  `;
  if (current) {
    const art = document.getElementById("tvArt");
    renderArtwork(art, current.art);
  }
}

function renderVoting() {
  const prompt = state.revealPrompt;
  const voted = state.participants.filter((player) => player.voted).length;
  tv.innerHTML = `
    <section class="tv-screen tv-voting">
      <div class="tv-kicker">Phones out</div>
      <h1>Vote for your favorite</h1>
      <p>${escapeHtml(prompt.text)}</p>
      <div class="tv-vote-pulse" aria-hidden="true">☝️ 👑 ⭐</div>
      <div class="tv-progress">${voted}/${state.participants.length} voted</div>
    </section>
  `;
}

function renderScoring() {
  const result = state.roundResult;
  if (!result) {
    tv.innerHTML = `<section class="tv-screen tv-scoring"><h1>Tallying votes…</h1></section>`;
    return;
  }
  const winnersHtml = result.winners.length
    ? result.winners.map((winner) => `
        <div class="tv-scoring-card">
          <div class="tv-art-stage scoring-art" data-art-id="${escapeHtml(winner.id)}"></div>
          <div class="tv-artist">${escapeHtml(winner.name)}</div>
          <div class="tv-points-badge">+1 point</div>
        </div>
      `).join("")
    : `<p class="tv-progress">No votes were cast this round.</p>`;
  const titleText = result.winners.length > 1 ? "Tied for the win!" : "Round winner!";
  tv.innerHTML = `
    <section class="tv-screen tv-scoring">
      <div class="tv-kicker">Round ${result.promptIndex + 1} of 3</div>
      <h1>${escapeHtml(titleText)}</h1>
      <p class="tv-prompt-line">${escapeHtml(result.promptText)}</p>
      <div class="tv-scoring-grid">${winnersHtml}</div>
      ${result.votes ? `<div class="tv-progress">${result.votes} vote${result.votes === 1 ? "" : "s"}</div>` : ""}
    </section>
  `;
  for (const winner of result.winners) {
    const stage = tv.querySelector(`.scoring-art[data-art-id="${cssEscape(winner.id)}"]`);
    if (stage && winner.art) renderArtwork(stage, winner.art);
  }
}

function renderFinal() {
  const leaderboard = state.leaderboard || [];
  const totalSteps = leaderboard.length + 1;
  const stepIndex = Math.min(state.finalRevealIndex || 0, totalSteps - 1);
  if (!leaderboard.length) {
    tv.innerHTML = `<section class="tv-screen tv-final"><h1>Game over</h1></section>`;
    return;
  }
  if (stepIndex === 0) {
    tv.innerHTML = `
      <section class="tv-screen tv-final-intro">
        <div class="tv-kicker">Final results</div>
        <h1 class="final-intro-title">Counting down…</h1>
        <p class="tv-progress">From ${ordinal(leaderboard.length)} place to the champion.</p>
      </section>
    `;
    return;
  }
  const playersRevealed = stepIndex;
  const revealedSlice = leaderboard.slice(-playersRevealed);
  const focusPlayer = leaderboard[leaderboard.length - playersRevealed];
  const focusRank = leaderboard.length - playersRevealed + 1;
  const isChampion = focusRank === 1;
  tv.innerHTML = `
    <section class="tv-screen tv-final ${isChampion ? "tv-final-champion" : ""}" data-step="${stepIndex}">
      <div class="tv-kicker">${isChampion ? "Champion" : `${ordinal(focusRank)} place`}</div>
      <div class="final-stage">
        <div class="tv-art-stage final-art" id="finalArt"></div>
        <h1 class="final-name">${escapeHtml(focusPlayer.name)}</h1>
        <div class="final-score">${focusPlayer.score} point${focusPlayer.score === 1 ? "" : "s"}</div>
      </div>
      <div class="tv-leaderboard final-leaderboard">
        ${leaderboard.map((player, index) => {
          const rank = index + 1;
          const revealed = revealedSlice.some((p) => p.id === player.id);
          const isFocus = focusPlayer.id === player.id;
          return `<div class="leaderboard-row ${revealed ? "revealed" : "pending"} ${isFocus ? "focus" : ""}">
            <strong>${rank}. ${revealed ? escapeHtml(player.name) : "???"}</strong>
            <span>${revealed ? player.score : "—"}</span>
          </div>`;
        }).join("")}
      </div>
      ${isChampion ? `<p class="tv-progress final-cta">Tap Play again on a phone to start another showdown.</p>` : ""}
    </section>
  `;
  const stage = document.getElementById("finalArt");
  if (stage && focusPlayer.bestArt) renderArtwork(stage, focusPlayer.bestArt);
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function startTimerInterval() {
  stopTimerInterval();
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 500);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const el = document.getElementById("tvTimer");
  if (!el || !state || state.phase !== "drawing" || !state.drawingEndsAt) return;
  const remainingMs = state.drawingEndsAt - Date.now();
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(remaining / 60);
  const s = String(remaining % 60).padStart(2, "0");
  el.textContent = `${m}:${s}`;
  el.classList.toggle("urgent", remaining <= 30);
  el.classList.toggle("critical", remaining <= 10);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
