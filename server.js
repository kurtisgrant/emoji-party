const express = require("express");
const http = require("http");
const os = require("os");
const path = require("path");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const ROOM = "emoji-showdown";
const MATCH_PROMPTS = 3;
const HAND_SIZE = 18;
const REVEAL_INTRO_MS = 4200;
const SHOWCASE_MS = 4300;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 8e6 });

app.use(express.static(path.join(__dirname, "public")));
app.get("/vendor/interact.min.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "interactjs", "dist", "interact.min.js"));
});
app.get("/host", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "host.html"));
});

const buckets = {
  people: ["👨‍🍳", "👩‍⚕️", "🧑‍💼", "🧑‍🚒", "🧑‍⚖️", "🧑‍🏫", "👮", "🕵️", "🧙", "🧛", "🧟", "🤖", "👶", "👴", "👰", "🤵"],
  animals: ["🐶", "🐱", "🐭", "🐸", "🐻", "🐔", "🦆", "🦈", "🐍", "🐛", "🦝", "🦖", "🐺", "🦉", "🐟", "🦑", "🐝"],
  placesThings: ["🏠", "🏢", "🏫", "🏥", "🏰", "🛒", "🚗", "✈️", "🚪", "🪑", "🛏️", "🗑️", "🏖️", "⛪", "🏭", "🚽"],
  faces: ["😭", "😡", "😱", "😬", "😍", "🤢", "🤯", "😈", "🫠", "😵‍💫", "😂", "😐", "🙄", "🥶", "😳"],
  actionsSymbols: ["🔥", "💥", "💨", "💬", "❌", "✅", "➡️", "⬇️", "🚫", "👀", "💤", "⚡", "💔", "💍", "👑", "📦"],
  objects: ["🎂", "🍕", "🍟", "🍎", "🍼", "🧸", "📄", "📱", "💻", "🔋", "🧹", "🧯", "🧃", "🪥", "🎁", "🧪"],
  weird: ["🧌", "🫃", "🦷", "🧠", "🦶", "🪦", "🪤", "🧻", "🪱", "🧽", "🥔", "🧦", "🥒", "🕳️", "🫎"],
  decoys: ["🧃", "🧽", "🚪", "🪑", "🐛", "🧦", "🥒", "📦", "⬇️", "🪥", "🕳️", "😐", "🫎", "🛏️"]
};

const keywordEmoji = {
  robot: ["🤖", "🔋", "💻", "⚡"],
  daycare: ["👶", "🍼", "🧸", "🚼"],
  baby: ["👶", "🍼", "🧸", "🚼"],
  wedding: ["👰", "🤵", "💍", "🎂"],
  ghost: ["👻", "🪦", "😱"],
  haunted: ["👻", "🪦", "😱"],
  shark: ["🦈", "🌊", "😱"],
  wizard: ["🧙", "✨", "🪄"],
  raccoon: ["🦝", "🗑️", "🌙"],
  cooking: ["👨‍🍳", "🔥", "🍕"],
  show: ["💬", "📱", "👀"],
  cowboy: ["🤠", "🐎", "🌵"],
  restaurant: ["🍕", "🍟", "👨‍🍳"],
  food: ["🍕", "🍟", "👨‍🍳"],
  court: ["🧑‍⚖️", "📄", "👔"],
  lawyer: ["🧑‍⚖️", "📄", "👔"],
  school: ["🏫", "🧑‍🏫", "📚"],
  business: ["🧑‍💼", "💼", "📈"],
  funeral: ["⚰️", "🪦", "😭"],
  fire: ["🔥", "💥", "🧯"],
  disaster: ["🔥", "💥", "😱"],
  space: ["🚀", "🛸", "🌕"],
  alien: ["👽", "🚀", "🛸"],
  pirate: ["🏴‍☠️", "⚓", "💰"],
  detective: ["🕵️", "📄", "👀"],
  dentist: ["🦷", "🪥", "😬"],
  dragon: ["🐉", "🔥", "🏰"],
  cat: ["🐱", "💬", "👑"],
  bear: ["🐻", "💼", "🏢"],
  clown: ["🤡", "🎈", "😭"],
  vampire: ["🧛", "🦷", "☀️"],
  king: ["👑", "🏰", "💸"],
  bees: ["🐝", "💥", "😱"],
  fish: ["🐟", "🚌", "😬"]
};

const forcedPromptEmojis = {
  "a raccoon hosting a cooking show": ["🦝", "👨‍🍳", "🔥"]
};

const prompts = [
  "a robot getting fired from a daycare",
  "a vampire working the day shift",
  "a cowboy trying to return soup",
  "a clown at a serious funeral",
  "a shark running a daycare",
  "a ghost getting ghosted",
  "a wizard failing tech support",
  "a king hiding from rent",
  "a raccoon hosting a cooking show",
  "a detective investigating his own birthday party",
  "a wedding ruined by bees",
  "a bear running a small business",
  "a haunted grocery store",
  "a pirate trying online dating",
  "a medieval peasant seeing a microwave",
  "a dentist discovering a dragon in the waiting room",
  "a fish trying to drive a bus",
  "a cat leading a corporate meeting",
  "a baby suing a restaurant",
  "an alien failing a job interview",
  "a robot opening a spa for ghosts",
  "a wizard stuck in airport security",
  "a shark teaching ballet in a mall",
  "a vampire becoming a lifeguard at noon",
  "a raccoon negotiating a peace treaty",
  "a cowboy trapped in a silent library",
  "a baby presenting quarterly earnings",
  "a ghost losing a hide and seek contest",
  "a king working the drive thru window",
  "a pirate crying during couples therapy",
  "a clown defending a thesis about soup",
  "a dragon trying to rent a studio apartment",
  "a cat firing its personal assistant",
  "a bear accidentally joining a wedding",
  "a fish running for mayor of a desert town",
  "a dentist judging a hot dog contest",
  "a robot asking a toaster for career advice",
  "a haunted elevator going to the wrong funeral",
  "a wizard teaching a dog to do taxes",
  "a shark shopping for tiny hats",
  "a vampire hosting a garlic tasting",
  "a raccoon failing a cooking inspection",
  "a cowboy attending a corporate retreat",
  "a baby reviewing a fancy restaurant",
  "a ghost trying to cancel a gym membership",
  "a king hiding in a public restroom",
  "a pirate opening a daycare during a storm",
  "a clown leading a disaster drill",
  "a dragon scared of birthday candles",
  "a cat explaining blockchain to a grandma",
  "a bear selling haunted real estate",
  "a fish doing standup comedy in court",
  "a dentist repairing a wizard's wand",
  "a robot officiating a chaotic wedding",
  "a haunted grocery cart escaping checkout",
  "a wizard losing a duel to a printer",
  "a shark trying to park a minivan",
  "a vampire stuck in a tanning salon",
  "a raccoon giving a motivational speech",
  "a cowboy getting banned from a buffet",
  "a baby cross-examining a firefighter",
  "a ghost accidentally becoming famous",
  "a king arguing with a vending machine",
  "a pirate trying to pass a driving test",
  "a clown babysitting serious lawyers",
  "a dragon applying for dental insurance",
  "a cat running a haunted hotel",
  "a bear pitching an app to investors",
  "a fish trapped in a business meeting",
  "a dentist discovering cursed soup",
  "an alien opening a funeral home",
  "a robot trying to be emotionally mysterious",
  "a wizard getting locked out of the cloud",
  "a shark hosting a peaceful book club",
  "a vampire selling umbrellas on the beach",
  "a raccoon stealing the wrong trash can",
  "a cowboy asking a salad for directions",
  "a baby managing a space launch",
  "a ghost getting roasted at a wedding",
  "a king losing a popularity contest to a chair",
  "a pirate teaching etiquette at school",
  "a clown stuck in jury duty",
  "a dragon trapped in a tiny elevator",
  "a cat judging a wizard talent show",
  "a bear pitching an app to investors",
  "a fish haunted by its online dating profile",
  "a dentist trying to calm an angry moon",
  "an alien misunderstanding a birthday party",
  "a robot losing custody of a houseplant",
  "a wizard running a suspicious food truck",
  "a shark failing a group project",
  "a vampire explaining sunscreen to a dragon",
  "a raccoon becoming the school principal",
  "a cowboy haunting a grocery store",
  "a baby firing a wedding planner",
  "a ghost running tech support for pirates",
  "a king hiding from a tiny invoice",
  "a pirate apologizing to a microwave"
];

const game = {
  phase: "lobby",
  prompts: [],
  currentPromptIndex: 0,
  revealPromptIndex: 0,
  showcaseIndex: 0,
  participants: new Set(),
  players: new Map(),
  usedPrompts: [],
  roundWinners: []
};

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

function idForName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32);
}

function choice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sample(items, count, avoid = new Set()) {
  const pool = items.filter((item) => !avoid.has(item));
  const picked = [];
  while (picked.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function providedForPrompt(prompt) {
  if (forcedPromptEmojis[prompt]) return forcedPromptEmojis[prompt];
  const lower = prompt.toLowerCase();
  const matches = [];
  for (const [key, emojis] of Object.entries(keywordEmoji)) {
    if (lower.includes(key)) matches.push(...emojis);
  }
  return [...new Set(matches)].slice(0, 3).concat(["✨", "💥", "👀"]).slice(0, 3);
}

function pickPrompts() {
  if (game.usedPrompts.length > prompts.length - MATCH_PROMPTS) game.usedPrompts = [];
  const selected = [];
  while (selected.length < MATCH_PROMPTS) {
    const prompt = choice(prompts.filter((item) => !game.usedPrompts.includes(item) && !selected.includes(item)));
    selected.push(prompt);
    game.usedPrompts.push(prompt);
  }
  return selected.map((prompt, index) => ({ index, text: prompt, provided: providedForPrompt(prompt) }));
}

function handForPrompt(promptInfo) {
  const avoid = new Set(promptInfo.provided);
  const hand = [...promptInfo.provided];
  const add = (items, count) => {
    for (const emoji of sample(items, count, avoid)) {
      hand.push(emoji);
      avoid.add(emoji);
    }
  };
  add(buckets.people, 2);
  add(buckets.animals, 2);
  add(buckets.placesThings, 2);
  add(buckets.faces, 3);
  add(buckets.actionsSymbols, 2);
  add(buckets.objects, 2);
  add(buckets.weird, 1);
  add(buckets.decoys, 1);
  while (hand.length < HAND_SIZE) add(Object.values(buckets).flat(), 1);
  return hand.sort(() => Math.random() - 0.5);
}

function makePlayer(id, name) {
  return {
    id,
    name,
    connected: true,
    sockets: new Set(),
    ready: false,
    score: 0,
    hands: {},
    art: {},
    submitted: {},
    votes: {}
  };
}

function activePlayers() {
  return [...game.participants].map((id) => game.players.get(id)).filter(Boolean);
}

function currentPrompt() {
  return game.prompts[game.currentPromptIndex] || null;
}

function revealPrompt() {
  return game.prompts[game.revealPromptIndex] || null;
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    connected: player.connected,
    ready: player.ready,
    score: player.score,
    submitted: Boolean(player.submitted[game.currentPromptIndex]),
    voted: Boolean(player.votes[game.revealPromptIndex])
  };
}

function submissionsFor(promptIndex, includeImage = false) {
  return activePlayers()
    .filter((player) => player.submitted[promptIndex])
    .map((player) => {
      const entry = { playerId: player.id, name: player.name };
      if (includeImage) entry.art = player.art[promptIndex] || null;
      return entry;
    });
}

function hostState() {
  const showcaseLike = ["revealIntro", "showcase", "voting"].includes(game.phase);
  const includeImage = ["showcase", "voting"].includes(game.phase);
  return {
    phase: game.phase,
    joinUrl: getLocalIp() ? `http://${getLocalIp()}:${PORT}` : null,
    players: [...game.players.values()].map(publicPlayer),
    participants: activePlayers().map(publicPlayer),
    prompts: game.prompts,
    currentPromptIndex: game.currentPromptIndex,
    revealPromptIndex: game.revealPromptIndex,
    currentPrompt: currentPrompt(),
    revealPrompt: revealPrompt(),
    showcaseIndex: game.showcaseIndex,
    submissions: submissionsFor(showcaseLike ? game.revealPromptIndex : game.currentPromptIndex, includeImage),
    roundWinners: game.roundWinners,
    leaderboard: activePlayers().map(publicPlayer).sort((a, b) => b.score - a.score)
  };
}

function playerState(playerId) {
  const player = game.players.get(playerId);
  const prompt = currentPrompt();
  const reveal = revealPrompt();
  return {
    ...hostState(),
    me: player ? {
      id: player.id,
      name: player.name,
      ready: player.ready,
      score: player.score,
      participant: game.participants.has(player.id),
      hand: prompt ? player.hands[prompt.index] || [] : [],
      art: [],
      submitted: prompt ? Boolean(player.submitted[prompt.index]) : false,
      vote: reveal ? player.votes[reveal.index] || null : null
    } : null
  };
}

function emitAll() {
  io.to(ROOM).emit("hostState", hostState());
  for (const [id, player] of game.players) {
    for (const socketId of player.sockets) {
      io.to(socketId).emit("playerState", playerState(id));
    }
  }
}

function startGame() {
  const readyPlayers = [...game.players.values()].filter((player) => player.connected && player.ready);
  if (!readyPlayers.length) return;
  game.phase = "drawing";
  game.prompts = pickPrompts();
  game.currentPromptIndex = 0;
  game.revealPromptIndex = 0;
  game.participants = new Set(readyPlayers.map((player) => player.id));
  game.roundWinners = [];
  for (const player of readyPlayers) {
    player.score = 0;
    player.art = {};
    player.submitted = {};
    player.votes = {};
    player.hands = {};
    for (const prompt of game.prompts) player.hands[prompt.index] = handForPrompt(prompt);
  }
  emitAll();
}

function maybeStartGame() {
  if (game.phase !== "lobby") return;
  const players = [...game.players.values()].filter((player) => player.connected);
  if (players.length && players.every((player) => player.ready)) startGame();
}

function maybeAdvanceDrawing() {
  if (game.phase !== "drawing") return;
  const promptIndex = game.currentPromptIndex;
  if (!activePlayers().every((player) => player.submitted[promptIndex])) return;
  if (game.currentPromptIndex < MATCH_PROMPTS - 1) {
    game.currentPromptIndex += 1;
  } else {
    startRevealIntro(0);
  }
  emitAll();
}

function startRevealIntro(promptIndex) {
  game.phase = "revealIntro";
  game.revealPromptIndex = promptIndex;
  game.showcaseIndex = 0;
  emitAll();
  setTimeout(() => {
    if (game.phase === "revealIntro" && game.revealPromptIndex === promptIndex) startShowcase(promptIndex);
  }, REVEAL_INTRO_MS);
}

function startShowcase(promptIndex) {
  game.phase = "showcase";
  game.showcaseIndex = 0;
  emitAll();
  scheduleNextShowcase(promptIndex);
}

function scheduleNextShowcase(promptIndex) {
  setTimeout(() => {
    if (game.phase !== "showcase" || game.revealPromptIndex !== promptIndex) return;
    const count = submissionsFor(promptIndex).length;
    if (game.showcaseIndex < count - 1) {
      game.showcaseIndex += 1;
      emitAll();
      scheduleNextShowcase(promptIndex);
    } else {
      startVoting(promptIndex);
    }
  }, SHOWCASE_MS);
}

function startVoting(promptIndex) {
  game.phase = "voting";
  game.showcaseIndex = 0;
  emitAll();
  maybeSkipVoteIfNeeded();
}

function eligibleVoters(promptIndex) {
  const submitted = new Set(submissionsFor(promptIndex).map((entry) => entry.playerId));
  return activePlayers().filter((player) => submitted.size > 1 && submitted.has(player.id));
}

function maybeSkipVoteIfNeeded() {
  const promptIndex = game.revealPromptIndex;
  if (eligibleVoters(promptIndex).length === 0) {
    setTimeout(() => {
      if (game.phase === "voting" && game.revealPromptIndex === promptIndex) advanceReveal();
    }, 1800);
  }
}

function maybeAdvanceReveal() {
  if (game.phase !== "voting") return;
  const voters = eligibleVoters(game.revealPromptIndex);
  if (voters.length && voters.every((player) => player.votes[game.revealPromptIndex])) advanceReveal();
}

function advanceReveal() {
  scoreRevealRound(game.revealPromptIndex);
  if (game.revealPromptIndex < MATCH_PROMPTS - 1) {
    startRevealIntro(game.revealPromptIndex + 1);
  } else {
    game.phase = "final";
    emitAll();
  }
}

function scoreRevealRound(promptIndex) {
  if (game.roundWinners.some((winner) => winner.promptIndex === promptIndex)) return;
  const counts = {};
  for (const player of activePlayers()) {
    const target = player.votes[promptIndex];
    if (target) counts[target] = (counts[target] || 0) + 1;
  }
  const top = Math.max(0, ...Object.values(counts));
  const winners = Object.entries(counts).filter(([, count]) => count === top && count > 0).map(([id]) => id);
  for (const id of winners) {
    const player = game.players.get(id);
    if (player) player.score += 1;
  }
  game.roundWinners.push({
    promptIndex,
    winners: winners.map((id) => ({ id, name: game.players.get(id)?.name || "Player" })),
    votes: top
  });
}

function resetToLobby() {
  game.phase = "lobby";
  game.prompts = [];
  game.currentPromptIndex = 0;
  game.revealPromptIndex = 0;
  game.showcaseIndex = 0;
  game.participants = new Set();
  game.roundWinners = [];
  for (const player of game.players.values()) {
    player.ready = false;
    player.hands = {};
    player.art = {};
    player.submitted = {};
    player.votes = {};
  }
}

io.on("connection", (socket) => {
  socket.join(ROOM);
  socket.on("host:join", () => socket.emit("hostState", hostState()));

  socket.on("host:reset", () => {
    for (const player of game.players.values()) {
      for (const socketId of player.sockets) io.to(socketId).emit("forceRejoin");
    }
    game.players.clear();
    resetToLobby();
    emitAll();
  });

  socket.on("player:join", (name, ack) => {
    const cleanName = String(name || "").trim().slice(0, 24);
    if (!cleanName) return ack?.({ ok: false, error: "Name required" });
    const id = idForName(cleanName);
    let player = game.players.get(id);
    if (!player) {
      player = makePlayer(id, cleanName);
      game.players.set(id, player);
    }
    player.name = cleanName;
    player.connected = true;
    player.sockets.add(socket.id);
    socket.data.playerId = id;
    ack?.({ ok: true, id });
    socket.emit("playerState", playerState(id));
    emitAll();
  });

  socket.on("player:ready", () => {
    const player = game.players.get(socket.data.playerId);
    if (!player) return;
    if (game.phase === "final") resetToLobby();
    if (game.phase !== "lobby") return;
    player.ready = true;
    emitAll();
    maybeStartGame();
  });

  socket.on("player:submitArt", (image) => {
    const player = game.players.get(socket.data.playerId);
    const prompt = currentPrompt();
    if (!player || !prompt || game.phase !== "drawing" || !game.participants.has(player.id)) return;
    const sanitized = sanitizeImage(image);
    if (!sanitized) return;
    player.art[prompt.index] = sanitized;
    player.submitted[prompt.index] = true;
    emitAll();
    maybeAdvanceDrawing();
  });

  socket.on("player:submitVote", (targetId) => {
    const player = game.players.get(socket.data.playerId);
    const prompt = revealPrompt();
    if (!player || !prompt || game.phase !== "voting" || !game.participants.has(player.id)) return;
    const valid = submissionsFor(prompt.index).some((entry) => entry.playerId === targetId && entry.playerId !== player.id);
    if (!valid) return;
    player.votes[prompt.index] = targetId;
    emitAll();
    maybeAdvanceReveal();
  });

  socket.on("disconnect", () => {
    const id = socket.data.playerId;
    const player = game.players.get(id);
    if (!player) return;
    player.sockets.delete(socket.id);
    player.connected = player.sockets.size > 0;
    emitAll();
  });
});

function sanitizeImage(image) {
  if (typeof image !== "string") return null;
  if (!image.startsWith("data:image/png;base64,") && !image.startsWith("data:image/jpeg;base64,")) return null;
  if (image.length > 4_000_000) return null;
  return image;
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

server.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log("Emoji Showdown is running.");
  console.log(`Host/TV: http://localhost:${PORT}/host`);
  console.log(`Players: http://localhost:${PORT}`);
  if (localIp) console.log(`Local network players: http://${localIp}:${PORT}`);
  else console.log("Local network URL unavailable. Use your laptop's local IP address with this port.");
});
