const socket = io();
const app = document.getElementById("app");

const MOVE_MIN = -250;
const MOVE_MAX = 350;
const SCALE_MIN = 0.25;
const SCALE_MAX = 40;
const MAX_EMOJIS = 24;

let playerName = localStorage.getItem("emojiShowdownName") || "";
let state = null;
let art = [];
let selectedId = null;
let dragGhost = null;
let activeCanvasPointers = new Map();
let canvasGesture = null;
let canvasDrag = null;
let lastTouchEnd = null;
const outlineCache = new Map();

setViewportHeight();
window.addEventListener("resize", setViewportHeight);
window.visualViewport?.addEventListener("resize", setViewportHeight);
window.visualViewport?.addEventListener("scroll", setViewportHeight);
document.addEventListener("touchend", preventDoubleTapZoom, { passive: false, capture: true });
document.addEventListener("dblclick", suppressTapZoom, { capture: true });

socket.on("connect", () => {
  if (playerName) join(playerName);
  else renderJoin();
});

socket.on("forceRejoin", () => {
  state = null;
  art = [];
  selectedId = null;
  playerName = "";
  localStorage.removeItem("emojiShowdownName");
  renderJoin("The host reset the game. Join again to play.");
});

socket.on("playerState", (next) => {
  const oldPrompt = state?.currentPrompt?.index;
  const oldPhase = state?.phase;
  state = next;
  if (next.me) {
    playerName = next.me.name;
    localStorage.setItem("emojiShowdownName", playerName);
  }

  if (next.phase === "drawing" && next.currentPrompt?.index !== oldPrompt) {
    art = withIds(next.me?.art || []);
    selectedId = art.at(-1)?.id || null;
  }

  if (oldPhase === "drawing" && next.phase === "drawing" && next.currentPrompt?.index === oldPrompt && !next.me?.submitted) return;
  render();
});

function join(name) {
  socket.emit("player:join", name, (res) => {
    if (!res?.ok) renderJoin(res?.error || "Could not join");
  });
}

function render() {
  stopDrawingTimer();
  if (!state?.me) return renderJoin();
  if (state.phase === "lobby") return renderLobby();
  if (!state.me.participant && state.phase !== "final") return renderWait("Game in progress", "You can join the next showdown.");
  if (state.phase === "drawing") return state.me.submitted ? renderWait("Submitted", "Nice. Waiting for the others.") : renderDrawing();
  if (state.phase === "revealIntro") return renderWait("Eyes up", "The TV is setting the scene.");
  if (state.phase === "showcase") return renderWait("Gallery time", "Watch every masterpiece on the TV.");
  if (state.phase === "voting") return state.me.vote ? renderWait("Vote locked", "The TV will move on when voting is done.") : renderVoting();
  if (state.phase === "scoring") return renderWait("Score time", "Look at the TV — winners are revealed.");
  if (state.phase === "final") return renderFinal();
  renderWait("Waiting", "Look at the TV.");
}

function renderJoin(error = "") {
  app.className = "join-card";
  app.innerHTML = `
    <form class="phone-panel" id="joinForm">
      <h1 class="brand">Emoji Showdown</h1>
      <p class="muted">Join the local game.</p>
      ${error ? `<p>${escapeHtml(error)}</p>` : ""}
      <input id="nameInput" maxlength="24" autocomplete="name" placeholder="Your name" value="${escapeHtml(playerName)}">
      <button>Join</button>
    </form>
  `;
  document.getElementById("joinForm").onsubmit = (event) => {
    event.preventDefault();
    const name = document.getElementById("nameInput").value.trim();
    if (name) join(name);
  };
}

function renderLobby() {
  app.className = "app";
  app.innerHTML = `
    <section class="phone-panel simple-phone">
      <h1 class="brand">Emoji Showdown</h1>
      <p class="prompt">Ready up when everyone is in.</p>
      <div class="players">${state.players.map((player) => `
        <div class="player-row"><strong>${escapeHtml(player.name)}</strong><span>${player.ready ? "ready" : "waiting"}</span></div>
      `).join("")}</div>
      <button id="readyBtn" ${state.me.ready ? "disabled" : ""}>${state.me.ready ? "Ready" : "I'm ready"}</button>
    </section>
  `;
  document.getElementById("readyBtn").onclick = () => socket.emit("player:ready");
}

function renderWait(title, message) {
  app.className = "app";
  app.innerHTML = `
    <section class="phone-panel simple-phone">
      <h1>${escapeHtml(title)}</h1>
      <p class="prompt">${escapeHtml(message)}</p>
      <p class="muted">Playing as ${escapeHtml(state.me.name)}.</p>
    </section>
  `;
}

function renderDrawing() {
  app.className = "app drawing-app drawlab-app";
  if (!art.length && state.me.art?.length) {
    art = withIds(state.me.art);
    selectedId = art.at(-1)?.id || null;
  }
  const prompt = state.currentPrompt;
  app.innerHTML = `
    <section class="phone-panel">
      <div class="editor-shell drawing-panel">
        <div class="drawing-hud">
          <p class="prompt">${escapeHtml(prompt.text)}</p>
          <span class="pill">${prompt.index + 1}/3</span>
          <span class="pill drawing-timer" id="drawingTimer">--:--</span>
        </div>
        <div class="drawing-stage">
          <div id="editorCanvas" class="editor-canvas"></div>
        </div>
        <div class="edit-toolbar">
          <button class="secondary" id="selectPrev" ${canCycleSelection(-1) ? "" : "disabled"}>‹</button>
          <button class="secondary" id="selectNext" ${canCycleSelection(1) ? "" : "disabled"}>›</button>
          <button class="secondary" id="layerDown" ${canMoveLayer(-1) ? "" : "disabled"}>↓</button>
          <button class="secondary" id="layerUp" ${canMoveLayer(1) ? "" : "disabled"}>↑</button>
        </div>
        <div class="emoji-tray">
          <div class="hand" id="emojiHand"></div>
        </div>
        <div class="editor-actions">
          <button class="secondary delete-action" id="deleteArt" ${currentItem() ? "" : "disabled"} aria-label="Delete selected">🗑️</button>
          <button id="finishArt">Finish</button>
          <span class="pill">${art.length}/${MAX_EMOJIS}</span>
        </div>
      </div>
    </section>
  `;
  renderEditor();
  renderHand();
  document.getElementById("deleteArt").onclick = deleteSelected;
  document.getElementById("selectPrev").onclick = () => cycleSelection(-1);
  document.getElementById("selectNext").onclick = () => cycleSelection(1);
  document.getElementById("layerDown").onclick = () => moveCurrentLayer(-1);
  document.getElementById("layerUp").onclick = () => moveCurrentLayer(1);
  document.getElementById("finishArt").onclick = () => {
    submitCurrentArt();
  };
  startDrawingTimer();
}

let drawingTimerInterval = null;
let lastTimedPromptIndex = null;
let autoSubmitFiredFor = null;

function startDrawingTimer() {
  stopDrawingTimer();
  if (state?.currentPrompt?.index !== lastTimedPromptIndex) {
    lastTimedPromptIndex = state?.currentPrompt?.index ?? null;
    autoSubmitFiredFor = null;
  }
  updateDrawingTimer();
  drawingTimerInterval = setInterval(updateDrawingTimer, 500);
}

function stopDrawingTimer() {
  if (drawingTimerInterval) {
    clearInterval(drawingTimerInterval);
    drawingTimerInterval = null;
  }
}

function updateDrawingTimer() {
  if (!state || state.phase !== "drawing" || !state.drawingEndsAt) return;
  const el = document.getElementById("drawingTimer");
  const remaining = Math.max(0, Math.ceil((state.drawingEndsAt - Date.now()) / 1000));
  if (el) {
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, "0");
    el.textContent = `${m}:${s}`;
    el.classList.toggle("urgent", remaining <= 30);
    el.classList.toggle("critical", remaining <= 10);
  }
  if (remaining <= 0 && state.me?.participant && !state.me?.submitted) {
    const promptIdx = state.currentPrompt?.index ?? null;
    if (autoSubmitFiredFor !== promptIdx) {
      autoSubmitFiredFor = promptIdx;
      submitCurrentArt();
    }
  }
}

function submitCurrentArt() {
  try {
    socket.emit("player:submitArt", rasterizeArt());
  } catch (error) {
    console.warn("Submit failed", error);
    socket.emit("player:submitArt", "");
  }
}

function rasterizeArt() {
  const liveFrame = document.querySelector("#editorCanvas .art-frame");
  const liveRect = liveFrame ? liveFrame.getBoundingClientRect() : null;
  const liveHeight = liveRect ? Math.max(1, liveRect.height) : 600;
  const liveWidth = liveRect ? Math.max(1, liveRect.width) : 750;
  const width = 1200;
  const height = 960;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f6f1e4";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  const gridStepX = (24 / liveWidth) * width;
  const gridStepY = (24 / liveHeight) * height;
  for (let x = gridStepX; x < width; x += gridStepX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = gridStepY; y < height; y += gridStepY) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  const fontPx = (42 / liveHeight) * height;
  for (const item of [...art].sort((a, b) => a.z - b.z)) {
    const px = (item.x / 100) * width;
    const py = (item.y / 100) * height;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
    ctx.scale(item.flipped ? -item.scale : item.scale, item.scale);
    ctx.font = `${fontPx}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.emoji, 0, 0);
    ctx.restore();
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}

function renderVoting() {
  const prompt = state.revealPrompt;
  const choices = state.submissions.filter((entry) => entry.playerId !== state.me.id);
  app.className = "app";
  app.innerHTML = `
    <section class="phone-panel vote-phone">
      <h2>Pick your favorite</h2>
      <p class="prompt">${escapeHtml(prompt.text)}</p>
      <div class="vote-options" id="voteOptions"></div>
    </section>
  `;
  const options = document.getElementById("voteOptions");
  if (!choices.length) {
    options.innerHTML = `<p class="muted">No vote needed this round.</p>`;
    return;
  }
  choices.forEach((entry, index) => {
    const btn = document.createElement("button");
    btn.className = "vote-card";
    btn.innerHTML = `<strong class="vote-anon">Artist ${index + 1}</strong><div></div>`;
    renderArtwork(btn.querySelector("div"), entry.art);
    btn.onclick = () => socket.emit("player:submitVote", entry.playerId);
    options.appendChild(btn);
  });
}

function renderFinal() {
  app.className = "app";
  const leaderboard = state.leaderboard || [];
  const totalSteps = leaderboard.length + 1;
  const stepIndex = Math.min(state.finalRevealIndex || 0, totalSteps - 1);
  const ceremonyDone = stepIndex >= totalSteps - 1;
  if (!ceremonyDone) {
    app.innerHTML = `
      <section class="phone-panel simple-phone">
        <h1>Final results</h1>
        <p class="prompt">Watch the TV — places are being revealed.</p>
      </section>
    `;
    return;
  }
  app.innerHTML = `
    <section class="phone-panel simple-phone">
      <h1>Game over</h1>
      <div class="leaderboard">${leaderboard.map((player, index) => `
        <div class="player-row"><strong>${index + 1}. ${escapeHtml(player.name)}</strong><span>${player.score}</span></div>
      `).join("")}</div>
      <button id="playAgain">Play again</button>
    </section>
  `;
  document.getElementById("playAgain").onclick = () => socket.emit("player:ready");
}

function renderEditor() {
  const canvas = document.getElementById("editorCanvas");
  renderArtwork(canvas, art);
  const frame = canvas.querySelector(".art-frame");
  frame.classList.add("drawlab-frame");
  frame.addEventListener("pointerdown", (event) => startCanvasPointer(event, frame));
  frame.addEventListener("pointermove", (event) => moveCanvasPointer(event, frame));
  frame.addEventListener("pointerup", endCanvasPointer);
  frame.addEventListener("pointercancel", endCanvasPointer);
  frame.addEventListener("lostpointercapture", endCanvasPointer);

  const current = currentItem();
  for (const el of frame.querySelectorAll(".placed-emoji")) {
    const isCurrent = Boolean(current && el.dataset.id === current.id);
    el.classList.toggle("selected", isCurrent);
    el.classList.toggle("locked", !isCurrent);
    const item = art.find((entry) => entry.id === el.dataset.id);
    if (item && isCurrent) {
      applyPixelOutline(el, item);
      wirePlacedEmoji(el, item, frame);
    }
  }
}

function renderHand() {
  const handEl = document.getElementById("emojiHand");
  for (const emoji of state.me.hand) {
    const tile = document.createElement("div");
    tile.className = `emoji-btn ${art.length >= MAX_EMOJIS ? "disabled" : ""}`;
    tile.textContent = emoji;
    if (art.length < MAX_EMOJIS) {
      tile.addEventListener("pointerdown", (event) => startEmojiDrag(event, emoji));
      tile.addEventListener("touchend", suppressTapZoom, { passive: false });
      tile.addEventListener("dblclick", suppressTapZoom);
    }
    handEl.appendChild(tile);
  }
}

function startEmojiDrag(event, emoji) {
  if (art.length >= MAX_EMOJIS) return;
  event.preventDefault();
  event.stopPropagation();
  let placed = false;
  const item = makeItem(emoji, 50, 50);
  dragGhost = document.createElement("div");
  dragGhost.className = "ghost-drag";
  dragGhost.textContent = emoji;
  document.body.appendChild(dragGhost);
  moveGhost(event.clientX, event.clientY);

  const move = (moveEvent) => {
    moveGhost(moveEvent.clientX, moveEvent.clientY);
    const frame = document.querySelector("#editorCanvas .art-frame");
    const point = frame ? pointInFrame(moveEvent, frame) : null;
    if (!point) return;
    item.x = point.x;
    item.y = point.y;
    if (!placed) {
      art.push(item);
      selectedId = item.id;
      placed = true;
      renderDrawing();
    } else {
      updateItemElement(item);
    }
  };

  const up = (upEvent) => {
    const frame = document.querySelector("#editorCanvas .art-frame");
    const point = frame ? pointInFrame(upEvent, frame) : null;
    if (!placed) {
      if (point) {
        item.x = point.x;
        item.y = point.y;
      }
      art.push(item);
      selectedId = item.id;
      renderDrawing();
    }
    cleanupGhost();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function wirePlacedEmoji(el, item, frame) {
  interact(el).unset();
  interact(el).styleCursor(false).draggable({
    inertia: false,
    listeners: {
      start() {
        selectedId = item.id;
        markSelected();
      },
      move(event) {
        const rect = frame.getBoundingClientRect();
        item.x = clamp(item.x + (event.dx / rect.width) * 100, MOVE_MIN, MOVE_MAX);
        item.y = clamp(item.y + (event.dy / rect.height) * 100, MOVE_MIN, MOVE_MAX);
        updateItemElement(item);
      }
    }
  });
}

function makeItem(emoji, x, y) {
  return { id: newId(), emoji, x, y, scale: 1.7, rotation: 0, flipped: false, z: nextLayer() };
}

function deleteSelected() {
  if (selectedId) art = art.filter((item) => item.id !== selectedId);
  else art.pop();
  normalizeLayers();
  selectedId = art.at(-1)?.id || null;
  renderDrawing();
}

function startCanvasPointer(event, frame) {
  const item = currentItem();
  if (!item) return;
  event.preventDefault();
  event.stopPropagation();
  frame.setPointerCapture?.(event.pointerId);
  activeCanvasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activeCanvasPointers.size === 1) {
    canvasDrag = { point: pointInFrame(event, frame, false), x: item.x, y: item.y };
    canvasGesture = null;
  }
  if (activeCanvasPointers.size === 2) {
    canvasGesture = makeCanvasGesture(item, frame);
    canvasDrag = null;
  }
}

function moveCanvasPointer(event, frame) {
  const item = currentItem();
  if (!item || !activeCanvasPointers.has(event.pointerId)) return;
  event.preventDefault();
  activeCanvasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activeCanvasPointers.size === 1 && canvasDrag) {
    const point = pointInFrame(event, frame, false);
    if (point) {
      item.x = clamp(canvasDrag.x + point.x - canvasDrag.point.x, MOVE_MIN, MOVE_MAX);
      item.y = clamp(canvasDrag.y + point.y - canvasDrag.point.y, MOVE_MIN, MOVE_MAX);
      updateItemElement(item);
    }
    return;
  }
  if (activeCanvasPointers.size < 2 || !canvasGesture) return;
  const [a, b] = [...activeCanvasPointers.values()];
  const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const midpoint = currentMidpoint();
  const point = midpoint ? pointInFrame(midpoint, frame, false) : null;
  if (point) {
    item.x = clamp(canvasGesture.x + point.x - canvasGesture.center.x, MOVE_MIN, MOVE_MAX);
    item.y = clamp(canvasGesture.y + point.y - canvasGesture.center.y, MOVE_MIN, MOVE_MAX);
  }
  item.scale = clamp(canvasGesture.scale * (distance / canvasGesture.distance), SCALE_MIN, SCALE_MAX);
  item.rotation = canvasGesture.rotation + angle - canvasGesture.angle;
  updateItemElement(item);
}

function endCanvasPointer(event) {
  try {
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
  } catch (_error) {
    // Capture may already be released on mobile browsers.
  }
  activeCanvasPointers.delete(event.pointerId);
  canvasDrag = null;
  if (activeCanvasPointers.size < 2) {
    canvasGesture = null;
    refreshSelectedOutline();
  }
}

function makeCanvasGesture(item, frame) {
  const [a, b] = [...activeCanvasPointers.values()];
  const midpoint = currentMidpoint();
  const center = midpoint ? pointInFrame(midpoint, frame, false) : null;
  return {
    center,
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
    x: item.x,
    y: item.y,
    scale: item.scale,
    rotation: item.rotation
  };
}

function currentMidpoint() {
  const [a, b] = [...activeCanvasPointers.values()];
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function currentItem() {
  return art.find((item) => item.id === selectedId) || art.at(-1) || null;
}

function applyPixelOutline(el, item) {
  el.classList.add("pixel-selected");
  el.textContent = "";
  const img = document.createElement("img");
  img.className = "emoji-outline-img";
  img.alt = item.emoji;
  img.draggable = false;
  img.dataset.outlineBucket = outlineBucket(item.scale);
  img.src = outlinedEmojiUrl(item.emoji, item.scale);
  el.appendChild(img);
}

function outlinedEmojiUrl(emoji, scale = 1) {
  const scaleBucket = Number(outlineBucket(scale));
  const cacheKey = `${emoji}:${scaleBucket}`;
  if (outlineCache.has(cacheKey)) return outlineCache.get(cacheKey);
  const renderFactor = Math.min(2, Math.max(1, Math.sqrt(scaleBucket)));
  const size = Math.round(384 * renderFactor);
  const fontSize = Math.round(224 * renderFactor);
  const outlineRadius = Math.max(3, Math.min(15, Math.round(24 * renderFactor / scaleBucket)));
  const source = document.createElement("canvas");
  source.width = size;
  source.height = size;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  sourceCtx.textAlign = "center";
  sourceCtx.textBaseline = "middle";
  sourceCtx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  sourceCtx.fillText(emoji, size / 2, size / 2 + 3);
  const sourceData = sourceCtx.getImageData(0, 0, size, size);
  const sourcePixels = sourceData.data;
  const silhouette = document.createElement("canvas");
  silhouette.width = size;
  silhouette.height = size;
  const silhouetteCtx = silhouette.getContext("2d");
  const silhouetteData = silhouetteCtx.createImageData(size, size);
  const silhouettePixels = silhouetteData.data;
  for (let index = 0; index < sourcePixels.length; index += 4) {
    if (sourcePixels[index + 3] > 32) {
      silhouettePixels[index] = 47;
      silhouettePixels[index + 1] = 213;
      silhouettePixels[index + 2] = 255;
      silhouettePixels[index + 3] = 120;
    }
  }
  silhouetteCtx.putImageData(silhouetteData, 0, 0);
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const outCtx = out.getContext("2d");
  const offsets = outlineOffsets(outlineRadius);
  outCtx.globalAlpha = 0.78;
  for (const [dx, dy] of offsets) outCtx.drawImage(silhouette, dx, dy);
  outCtx.globalAlpha = 0.32;
  outCtx.filter = `blur(${Math.max(0.7, renderFactor * 0.55)}px)`;
  for (const [dx, dy] of offsets) outCtx.drawImage(silhouette, dx, dy);
  outCtx.filter = "none";
  outCtx.globalAlpha = 1;
  outCtx.globalCompositeOperation = "destination-out";
  outCtx.drawImage(source, 0, 0);
  outCtx.globalCompositeOperation = "source-over";
  outCtx.drawImage(source, 0, 0);
  const url = out.toDataURL("image/png");
  outlineCache.set(cacheKey, url);
  return url;
}

function outlineOffsets(radius) {
  const offsets = [];
  const seen = new Set();
  for (let degrees = 0; degrees < 360; degrees += 10) {
    for (const r of [radius, Math.max(1, radius - 2)]) {
      const x = Math.round(Math.cos(degrees * Math.PI / 180) * r);
      const y = Math.round(Math.sin(degrees * Math.PI / 180) * r);
      const key = `${x},${y}`;
      if (!seen.has(key)) {
        seen.add(key);
        offsets.push([x, y]);
      }
    }
  }
  return offsets;
}

function updateItemElement(item) {
  const el = document.querySelector(`.placed-emoji[data-id="${CSS.escape(item.id)}"]`);
  if (!el) return;
  el.style.left = `${item.x}%`;
  el.style.top = `${item.y}%`;
  el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`;
}

function refreshSelectedOutline(item = currentItem()) {
  if (!item) return;
  const el = document.querySelector(`.placed-emoji[data-id="${CSS.escape(item.id)}"]`);
  const img = el?.querySelector(".emoji-outline-img");
  if (!img) return;
  const bucket = outlineBucket(item.scale);
  if (img.dataset.outlineBucket !== bucket) {
    img.dataset.outlineBucket = bucket;
    img.src = outlinedEmojiUrl(item.emoji, item.scale);
  }
}

function markSelected() {
  for (const el of document.querySelectorAll(".placed-emoji")) el.classList.toggle("selected", el.dataset.id === selectedId);
}

function pointInFrame(pointer, frame, requireInside = true) {
  const rect = frame.getBoundingClientRect();
  const clientX = pointer.clientX ?? pointer.x;
  const clientY = pointer.clientY ?? pointer.y;
  if (requireInside && (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom)) return null;
  return {
    x: clamp(((clientX - rect.left) / rect.width) * 100, MOVE_MIN, MOVE_MAX),
    y: clamp(((clientY - rect.top) / rect.height) * 100, MOVE_MIN, MOVE_MAX)
  };
}

function withIds(value) {
  return JSON.parse(JSON.stringify(value || [])).map((item) => ({ id: newId(), ...item }));
}

function nextLayer() {
  return art.reduce((max, item) => Math.max(max, item.z), -1) + 1;
}

function normalizeLayers() {
  [...art].sort((a, b) => a.z - b.z).forEach((item, index) => {
    item.z = index;
  });
}

function currentLayerIndex() {
  const current = currentItem();
  if (!current) return -1;
  return [...art].sort((a, b) => a.z - b.z).findIndex((item) => item.id === current.id);
}

function canMoveLayer(direction) {
  const index = currentLayerIndex();
  if (index < 0) return false;
  return direction < 0 ? index > 0 : index < art.length - 1;
}

function moveCurrentLayer(direction) {
  const current = currentItem();
  if (!current || !canMoveLayer(direction)) return;
  const ordered = [...art].sort((a, b) => a.z - b.z);
  const index = ordered.findIndex((item) => item.id === current.id);
  const other = ordered[index + direction];
  const oldZ = current.z;
  current.z = other.z;
  other.z = oldZ;
  selectedId = current.id;
  renderDrawing();
}

function selectedArtIndex() {
  const current = currentItem();
  return current ? art.findIndex((item) => item.id === current.id) : -1;
}

function canCycleSelection(direction) {
  if (art.length < 2) return false;
  const index = selectedArtIndex();
  if (index < 0) return false;
  return direction < 0 ? index > 0 : index < art.length - 1;
}

function cycleSelection(direction) {
  if (!canCycleSelection(direction)) return;
  selectedId = art[selectedArtIndex() + direction].id;
  renderDrawing();
}

function outlineBucket(scale) {
  return String(Math.max(1, Math.min(16, Math.round(scale * 2) / 2)));
}

function setViewportHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function moveGhost(x, y) {
  if (!dragGhost) return;
  dragGhost.style.left = `${x}px`;
  dragGhost.style.top = `${y}px`;
}

function cleanupGhost() {
  dragGhost?.remove();
  dragGhost = null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function preventDoubleTapZoom(event) {
  const now = Date.now();
  const touch = event.changedTouches?.[0];
  const tap = { time: now, x: touch?.clientX ?? 0, y: touch?.clientY ?? 0, zone: tapZone(event.target) };
  if (lastTouchEnd && tap.time - lastTouchEnd.time < 340 && Math.hypot(tap.x - lastTouchEnd.x, tap.y - lastTouchEnd.y) < 28 && tap.zone && tap.zone === lastTouchEnd.zone) {
    event.preventDefault();
    event.stopPropagation();
  }
  lastTouchEnd = tap;
}

function tapZone(target) {
  if (!(target instanceof Element)) return "";
  const zone = target.closest("button, .pill, .emoji-btn, .edit-toolbar, .emoji-tray");
  return zone ? zone.id || zone.className || zone.tagName : "";
}

function suppressTapZoom(event) {
  event.preventDefault();
  event.stopPropagation();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
