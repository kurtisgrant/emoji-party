const socket = io();
const tv = document.getElementById("tv");
let state = null;

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
  if (state.phase === "lobby") return renderLobby();
  if (state.phase === "drawing") return renderDrawing();
  if (state.phase === "revealIntro") return renderRevealIntro();
  if (state.phase === "showcase") return renderShowcase();
  if (state.phase === "voting") return renderVoting();
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
      <div class="tv-roster">
        <div class="tv-progress">${ready}/${state.players.length} ready</div>
        <div class="tv-player-grid">
          ${state.players.map((player) => `<div class="tv-player ${player.ready ? "ready" : ""}">${escapeHtml(player.name)}<span>${player.ready ? "ready" : "..."}</span></div>`).join("") || `<div class="tv-player">Waiting for artists</div>`}
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
      <div class="tv-progress">${submitted}/${state.participants.length} submitted</div>
    </section>
  `;
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
      <div class="tv-progress">No voting yet</div>
    </section>
  `;
  if (current) {
    const art = document.getElementById("tvArt");
    renderArtwork(art, current.art);
    const name = document.createElement("div");
    name.className = "tv-artist";
    name.textContent = current.name;
    art.appendChild(name);
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
      <div class="tv-progress">${voted}/${state.participants.length} voted</div>
    </section>
  `;
}

function renderFinal() {
  const winner = state.leaderboard?.[0];
  tv.innerHTML = `
    <section class="tv-screen tv-final">
      <div class="tv-kicker">Champion</div>
      <h1>${winner ? escapeHtml(winner.name) : "Nobody"}</h1>
      <div class="tv-leaderboard">
        ${(state.leaderboard || []).map((player, index) => `<div><strong>${index + 1}. ${escapeHtml(player.name)}</strong><span>${player.score}</span></div>`).join("")}
      </div>
      <p>Tap Play again on a phone to start another showdown.</p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
