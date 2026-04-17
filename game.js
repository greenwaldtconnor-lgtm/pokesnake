const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const badgesEl = document.getElementById("badges");
const bestEl = document.getElementById("best");
const messageEl = document.getElementById("message");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const usernameEl = document.getElementById("username");
const saveTrainerButton = document.getElementById("saveTrainerButton");
const leaderboardEl = document.getElementById("leaderboard");
const pauseButton = document.getElementById("pauseButton");
const controlButtons = document.querySelectorAll("[data-direction]");

const TILE_SIZE = 28;
const GRID_SIZE = 18;
const BADGE_EVERY = 5;
const BEST_KEY = "pocket-snake-league-best";
const TRAINER_KEY = "pocket-snake-league-trainer";
const LEADERBOARD_KEY = "pocket-snake-league-leaderboard";
const LEADERBOARD_LIMIT = 5;

const directionMap = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 }
};

const buttonDirectionMap = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const leaderboard = loadLeaderboard();

const state = {
  snake: [],
  direction: { x: 1, y: 0 },
  queuedDirection: { x: 1, y: 0 },
  berry: null,
  rocks: [],
  score: 0,
  badges: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  trainerName: localStorage.getItem(TRAINER_KEY) || "Trainer",
  gameOver: false,
  running: false,
  paused: false,
  speedMs: 140,
  tickId: null
};

function resetGame() {
  state.snake = [
    { x: 4, y: 9 },
    { x: 3, y: 9 },
    { x: 2, y: 9 }
  ];
  state.direction = { x: 1, y: 0 };
  state.queuedDirection = { x: 1, y: 0 };
  state.score = 0;
  state.badges = 0;
  state.gameOver = false;
  state.running = false;
  state.paused = false;
  state.speedMs = 140;
  pauseButton.textContent = "Pause";
  state.rocks = buildRocks();
  placeBerry();
  syncHud();
  setMessage(`${state.trainerName}, your adventure is ready. Press Start Adventure to begin.`);
  draw();
}

function loadLeaderboard() {
  try {
    const stored = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveLeaderboard() {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
}

function renderLeaderboard() {
  leaderboardEl.innerHTML = "";

  if (!leaderboard.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No champions yet. Start a run to claim the first badge.";
    leaderboardEl.append(emptyItem);
    return;
  }

  leaderboard.forEach((entry) => {
    const item = document.createElement("li");

    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = entry.name;

    const meta = document.createElement("span");
    meta.className = "leaderboard-meta";
    meta.textContent = `${entry.score} pts | ${entry.badges} badges`;

    item.append(name, meta);
    leaderboardEl.append(item);
  });
}

function sanitizeTrainerName(value) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || "Trainer";
}

function saveTrainerName() {
  state.trainerName = sanitizeTrainerName(usernameEl.value);
  usernameEl.value = state.trainerName;
  localStorage.setItem(TRAINER_KEY, state.trainerName);
  setMessage(`Trainer profile saved. ${state.trainerName} is ready for the next run.`);
}

function updateBestFromLeaderboard() {
  const leaderboardBest = leaderboard.length ? leaderboard[0].score : 0;
  state.best = Math.max(state.best, leaderboardBest);
  localStorage.setItem(BEST_KEY, String(state.best));
}

function addLeaderboardEntry() {
  if (state.score <= 0) {
    return;
  }

  leaderboard.push({
    name: state.trainerName,
    score: state.score,
    badges: state.badges
  });

  leaderboard.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.badges - a.badges;
  });

  leaderboard.splice(LEADERBOARD_LIMIT);
  saveLeaderboard();
  updateBestFromLeaderboard();
  renderLeaderboard();
}

function buildRocks() {
  const rocks = [];
  const layout = [
    { x: 6, y: 4 },
    { x: 7, y: 4 },
    { x: 10, y: 13 },
    { x: 11, y: 13 },
    { x: 13, y: 6 },
    { x: 13, y: 7 },
    { x: 4, y: 13 }
  ];

  for (const rock of layout) {
    rocks.push(rock);
  }

  return rocks;
}

function placeBerry() {
  const occupied = new Set([
    ...state.snake.map((segment) => `${segment.x},${segment.y}`),
    ...state.rocks.map((rock) => `${rock.x},${rock.y}`)
  ]);

  const openTiles = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) {
        openTiles.push({ x, y });
      }
    }
  }

  state.berry = openTiles[Math.floor(Math.random() * openTiles.length)];
}

function setMessage(text) {
  messageEl.textContent = text;
}

function syncHud() {
  scoreEl.textContent = String(state.score);
  badgesEl.textContent = String(state.badges);
  bestEl.textContent = String(state.best);
}

function startGame() {
  state.trainerName = sanitizeTrainerName(usernameEl.value);
  usernameEl.value = state.trainerName;
  localStorage.setItem(TRAINER_KEY, state.trainerName);

  if (state.gameOver) {
    resetGame();
  }

  if (state.running && !state.paused) {
    return;
  }

  state.running = true;
  state.paused = false;
  setMessage(`${state.trainerName}, badge hunt in progress. Stay sharp in the tall grass.`);
  scheduleTick();
}

function scheduleTick() {
  clearTimeout(state.tickId);
  if (!state.running || state.paused || state.gameOver) {
    return;
  }

  state.tickId = window.setTimeout(() => {
    step();
    draw();
    scheduleTick();
  }, state.speedMs);
}

function togglePause() {
  if (!state.running || state.gameOver) {
    return;
  }

  state.paused = !state.paused;
  setMessage(state.paused ? "Adventure paused." : "Adventure resumed.");
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  if (!state.paused) {
    scheduleTick();
  } else {
    clearTimeout(state.tickId);
  }
  draw();
}

function isOppositeDirection(next) {
  return state.direction.x + next.x === 0 && state.direction.y + next.y === 0;
}

function queueDirection(nextDirection) {
  if (!nextDirection || isOppositeDirection(nextDirection)) {
    return;
  }
  state.queuedDirection = nextDirection;
}

function step() {
  state.direction = state.queuedDirection;
  const head = state.snake[0];
  const nextHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y
  };

  const collidedWithWall =
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= GRID_SIZE ||
    nextHead.y >= GRID_SIZE;

  const collidedWithSelf = state.snake.some(
    (segment) => segment.x === nextHead.x && segment.y === nextHead.y
  );

  const collidedWithRock = state.rocks.some(
    (rock) => rock.x === nextHead.x && rock.y === nextHead.y
  );

  if (collidedWithWall || collidedWithSelf || collidedWithRock) {
    endGame();
    return;
  }

  state.snake.unshift(nextHead);

  if (nextHead.x === state.berry.x && nextHead.y === state.berry.y) {
    state.score += 1;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(BEST_KEY, String(state.best));
    }

    if (state.score % BADGE_EVERY === 0) {
      state.badges += 1;
      state.speedMs = Math.max(70, state.speedMs - 12);
      setMessage(`Badge earned. Leader rank ${state.badges} reached.`);
    } else {
      setMessage("Berry collected. Your team grew stronger.");
    }

    placeBerry();
    syncHud();
    return;
  }

  state.snake.pop();
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  state.paused = false;
  clearTimeout(state.tickId);
  pauseButton.textContent = "Pause";
  addLeaderboardEntry();
  syncHud();
  setMessage(`${state.trainerName} finished with ${state.score} points. Press Restart Run to try again.`);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const light = (x + y) % 2 === 0;
      ctx.fillStyle = light ? "#9de2ae" : "#7fcf90";
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.arc(22 + i * 35, 32 + (i % 2) * 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRocks() {
  for (const rock of state.rocks) {
    const px = rock.x * TILE_SIZE;
    const py = rock.y * TILE_SIZE;

    ctx.fillStyle = "#7a7f86";
    ctx.fillRect(px + 3, py + 4, TILE_SIZE - 6, TILE_SIZE - 7);

    ctx.fillStyle = "#959aa1";
    ctx.fillRect(px + 6, py + 7, TILE_SIZE - 16, TILE_SIZE - 14);
  }
}

function drawBerry() {
  if (!state.berry) {
    return;
  }

  const centerX = state.berry.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = state.berry.y * TILE_SIZE + TILE_SIZE / 2;

  ctx.fillStyle = "#e9534e";
  ctx.beginPath();
  ctx.arc(centerX, centerY + 2, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2c7e57";
  ctx.fillRect(centerX - 1.5, centerY - 9, 3, 6);
  ctx.beginPath();
  ctx.ellipse(centerX + 5, centerY - 6, 5, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake() {
  state.snake.forEach((segment, index) => {
    const px = segment.x * TILE_SIZE;
    const py = segment.y * TILE_SIZE;
    const isHead = index === 0;

    ctx.fillStyle = isHead ? "#2563d7" : "#3fa8ff";
    roundRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4, 8);
    ctx.fill();

    ctx.fillStyle = isHead ? "#f8f3d4" : "#d8ecff";
    roundRect(px + 7, py + 7, TILE_SIZE - 14, TILE_SIZE - 14, 5);
    ctx.fill();

    if (isHead) {
      const eyeY = py + 11;
      const leftEyeX = px + (state.direction.x === -1 ? 8 : 10);
      const rightEyeX = px + (state.direction.x === 1 ? 18 : 14);

      ctx.fillStyle = "#13203d";
      ctx.fillRect(leftEyeX, eyeY, 3, 3);
      ctx.fillRect(rightEyeX, eyeY, 3, 3);
    }
  });
}

function drawOverlay() {
  if (state.running && !state.paused && !state.gameOver) {
    return;
  }

  ctx.fillStyle = "rgba(20, 32, 61, 0.22)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let title = "Pocket Snake League";
  let subtitle = "Press Start Adventure";

  if (state.paused) {
    title = "Paused";
    subtitle = "Press Space to continue";
  } else if (state.gameOver) {
    title = "Adventure Over";
    subtitle = "Press Restart Run";
  }

  ctx.fillStyle = "#fff8e1";
  roundRect(80, 180, 344, 132, 24);
  ctx.fill();

  ctx.fillStyle = "#16302b";
  ctx.textAlign = "center";
  ctx.font = "bold 28px Trebuchet MS";
  ctx.fillText(title, canvas.width / 2, 228);
  ctx.font = "18px Trebuchet MS";
  ctx.fillText(subtitle, canvas.width / 2, 264);
  ctx.font = "14px Trebuchet MS";
  ctx.fillText("Collect berries. Avoid walls, rocks, and your own team.", canvas.width / 2, 290);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBadgeStrip() {
  for (let i = 0; i < state.badges; i += 1) {
    const x = 14 + i * 26;
    const y = 14;
    ctx.fillStyle = "#f4c546";
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x + 20, y + 10);
    ctx.lineTo(x + 10, y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9a6c0c";
    ctx.fillRect(x + 8, y + 8, 4, 4);
  }
}

function draw() {
  drawBoard();
  drawRocks();
  drawBerry();
  drawSnake();
  drawBadgeStrip();
  drawOverlay();
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
    return;
  }

  const nextDirection = directionMap[event.code];
  if (!nextDirection) {
    return;
  }

  event.preventDefault();
  queueDirection(nextDirection);
  if (!state.running && !state.gameOver) {
    startGame();
  }
});

controlButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextDirection = buttonDirectionMap[button.dataset.direction];
    queueDirection(nextDirection);
    if (!state.running && !state.gameOver) {
      startGame();
    }
  });
});

saveTrainerButton.addEventListener("click", saveTrainerName);
usernameEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveTrainerName();
  }
});

pauseButton.addEventListener("click", togglePause);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", resetGame);

usernameEl.value = state.trainerName;
updateBestFromLeaderboard();
renderLeaderboard();
resetGame();
