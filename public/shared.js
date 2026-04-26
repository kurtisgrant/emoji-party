function renderArtwork(container, art, options = {}) {
  container.innerHTML = "";
  container.classList.add("art-canvas");
  const frame = document.createElement("div");
  frame.className = "art-frame";
  if (typeof art === "string" && art.startsWith("data:image/")) {
    frame.classList.add("art-frame-image");
    const img = document.createElement("img");
    img.className = "art-image";
    img.src = art;
    img.alt = "";
    frame.appendChild(img);
    container.appendChild(frame);
    return;
  }
  if (options.prompt) {
    const prompt = document.createElement("div");
    prompt.className = "art-prompt";
    prompt.textContent = options.prompt;
    frame.appendChild(prompt);
  }
  [...(art || [])].sort((a, b) => a.z - b.z).forEach((item) => {
    const el = document.createElement("div");
    el.className = "placed-emoji";
    if (item.id) el.dataset.id = item.id;
    el.textContent = item.emoji;
    el.style.left = `${item.x}%`;
    el.style.top = `${item.y}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.flipped ? -item.scale : item.scale}, ${item.scale})`;
    el.style.zIndex = item.z;
    frame.appendChild(el);
  });
  container.appendChild(frame);
}

function countdownText(endsAt) {
  if (!endsAt) return "";
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function phaseLabel(phase) {
  return {
    lobby: "Lobby",
    drawing: "Drawing",
    revealIntro: "Reveal",
    showcase: "Gallery",
    voting: "Voting",
    scoring: "Scoring",
    final: "Final"
  }[phase] || phase;
}
