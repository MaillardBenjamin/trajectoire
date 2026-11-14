"use strict";

const playerColors = ["#a23b24", "#225d9b", "#23705a", "#773889"];
const byId = (id) => document.getElementById(id);
const board = byId("board");
const trackScroll = byId("track-scroll");
const trackDialog = byId("track-dialog");
const sheet = board.closest(".sheet");
const trackHome = sheet.parentElement;
const openTrack = byId("open-track");
const closeTrack = byId("close-track");
const locateCar = byId("locate-car");
const trackPass = byId("track-pass");
const canvas = byId("track");
const ctx = canvas.getContext("2d");
let race;
let preview = null;
let opponentWorker;
let opponentTimer;
const levels = { easy: "Faible", medium: "Moyen", hard: "Dur" };

function resetRace(track, started = false) {
  clearTimeout(opponentTimer);
  opponentWorker?.terminate();
  opponentWorker = undefined;
  const circuit = circuits[Number(circuitSelect.value) - 1];
  const playerCount = mode.value === "solo" ? 2 : Number(mode.value);
  const difficulty = mode.value === "solo" ? difficultySelect.value : null;
  const lapCount = Number(lapSelect.value);
  const lanes = { 2: [-1, 1], 3: [-1, 0, 1], 4: [-2, -1, 1, 2] }[playerCount];
  race = {
    track, started, moved: false, active: 0, winner: null, difficulty, lapCount,
    players: lanes.map((offset, index) => ({
      name: difficulty ? ["Toi", "Adversaire IA"][index] : `Joueur ${index + 1}`, color: playerColors[index], x: track.finish.x,
      y: track.finish.y + offset, dx: 1, dy: 0, speed: 0, restarting: false, checked: 0, laps: 0, lapCount,
      trail: [point(track.finish.x, track.finish.y + offset)]
    }))
  };
  if (started && difficulty && typeof Worker === "function") {
    try {
      opponentWorker = new Worker("opponent-worker.js");
      const currentRace = race;
      opponentWorker.addEventListener("error", () => {
        if (race !== currentRace) return;
        opponentWorker?.terminate();
        opponentWorker = undefined;
        if (race.active === 1 && !race.winner) requestOpponent();
      });
      opponentWorker.addEventListener("message", ({ data }) => {
        if (race === currentRace && race.active === 1 && !race.winner) opponentMove(data);
      });
      opponentWorker.postMessage({ track, start: race.players[1], difficulty });
    } catch {
      opponentWorker?.terminate();
      opponentWorker = undefined;
    }
  }
  byId("race-mode").textContent = difficulty ? `Solo · ${levels[difficulty]}` : "Papier quadrillé · A4";
  byId("race-name").textContent = circuit ?
    `${circuits.indexOf(circuit) + 1}/10 · ${circuit.name}` :
    "Circuit aléatoire";
  render();
}

function play(move) {
  if (!race.started || race.winner || !move.legal) return;
  race.moved = true;
  const player = race.players[race.active];
  const next = afterMove(race.track, player, move);
  Object.assign(player, next);
  player.trail.push(move.to);
  if (next.won) {
    player.laps++;
    player.checked = 0;
    if (player.laps === race.lapCount) race.winner = player;
  }
  if (!race.winner) race.active = (race.active + 1) % race.players.length;
  advanceTurn();
}

function pass() {
  if (!race.started || race.winner || getMoves(race).some((move) => move.legal)) return;
  const player = race.players[race.active];
  Object.assign(player, afterPass(player));
  race.active = (race.active + 1) % race.players.length;
  advanceTurn();
}

function advanceTurn() {
  render();
  if (race.difficulty && race.active === 1 && !race.winner) requestOpponent();
}

function requestOpponent() {
  clearTimeout(opponentTimer);
  opponentTimer = setTimeout(() => {
    if (opponentWorker) opponentWorker.postMessage({ players: race.players.map(({ trail, ...player }) => player) });
    else {
      race.opponent ??= createOpponent(race.track, race.players[1], race.difficulty);
      opponentMove(race.opponent(race.players));
    }
  }, 350);
}

function opponentMove(choice) {
  const legal = getMoves(race).filter((move) => move.legal);
  const move = legal.find(({ to }) => to.x === choice?.x && to.y === choice?.y) ?? legal[0];
  if (move) play(move);
  else pass();
  if (document.activeElement === document.body) focusTurn();
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const pixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const { track, players, active, winner } = race;
  const { spine, radius, finish } = track;
  ctx.setTransform(pixelWidth / columns, 0, 0, pixelHeight / rows, 0, 0);
  ctx.clearRect(0, 0, columns, rows);
  ctx.fillStyle = "#f6f5e9";
  ctx.fillRect(0, 0, columns, rows);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const path = (points) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  };
  path(spine);
  ctx.closePath();
  ctx.strokeStyle = "#525d59";
  ctx.lineWidth = 2 * radius + .19;
  ctx.stroke();
  ctx.strokeStyle = "#fffcf2";
  ctx.lineWidth = 2 * radius;
  ctx.stroke();

  ctx.lineWidth = .045;
  for (let x = 0; x <= columns; x++) {
    ctx.strokeStyle = x % 5 === 0 ? "#9baea76e" : "#9baea73f";
    path([point(x, 0), point(x, rows)]);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.strokeStyle = y % 5 === 0 ? "#9baea76e" : "#9baea73f";
    path([point(0, y), point(columns, y)]);
    ctx.stroke();
  }

  const cell = radius / 7;
  for (let index = 0; index < 28; index++) {
    ctx.fillStyle = (index + Math.floor(index / 2)) % 2 ? "#fffdf6" : "#34434b";
    ctx.fillRect(finish.x - cell + (index % 2) * cell, finish.y - radius + Math.floor(index / 2) * cell, cell, cell);
  }
  ctx.font = "bold .70px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#34434b";
  ctx.fillText("DÉPART / ARRIVÉE", finish.x, finish.y - radius - .45);
  ctx.strokeStyle = "#34434b";
  ctx.lineWidth = .11;
  path([point(finish.x + 2, finish.y), point(finish.x + 4, finish.y)]);
  ctx.stroke();
  path([point(finish.x + 3.5, finish.y - .4), point(finish.x + 4, finish.y), point(finish.x + 3.5, finish.y + .4)]);
  ctx.stroke();
  ctx.textAlign = "start";

  for (const player of players) {
    ctx.strokeStyle = player.color;
    ctx.lineWidth = .17;
    ctx.globalAlpha = .65;
    path(player.trail);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (preview && !winner) {
    ctx.strokeStyle = players[active].color;
    ctx.lineWidth = .16;
    ctx.setLineDash([.35, .22]);
    path([players[active], preview.to]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  players.forEach((player, index) => {
    const selected = winner === player || (!winner && index === active);
    if (selected) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, .51, 0, Math.PI * 2);
      ctx.lineWidth = .13;
      ctx.strokeStyle = player.color;
      ctx.stroke();
    }
    ctx.fillStyle = player.color;
    ctx.beginPath();
    if (player.trail.length === 1) {
      ctx.arc(player.x, player.y, .31, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(Math.atan2(player.dy, player.dx));
    ctx.moveTo(.46, 0);
    ctx.lineTo(-.06, -.29);
    ctx.lineTo(-.06, -.12);
    ctx.lineTo(-.39, -.12);
    ctx.lineTo(-.39, .12);
    ctx.lineTo(-.06, .12);
    ctx.lineTo(-.06, .29);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function render() {
  preview = null;
  const { active, players, winner } = race;
  const player = players[active];
  const aiTurn = Boolean(race.difficulty && active === 1 && !winner);
  const locked = race.moved && !winner;
  mode.disabled = circuitSelect.disabled = lapSelect.disabled = locked;
  difficultySelect.hidden = mode.value !== "solo";
  difficultySelect.disabled = locked || difficultySelect.hidden;
  startButton.hidden = locked;
  startButton.disabled = race.started && !winner;
  startButton.textContent = winner ? "Nouvelle course" : "Lancer la course";
  stopButton.hidden = !race.started || Boolean(winner);
  const moves = !race.started || winner || aiTurn ? [] : getMoves(race);
  const legal = moves.filter((move) => move.legal);
  byId("turn-label").textContent = winner ? "Course terminée" : aiTurn ? "Tour de l’IA" : "À toi de jouer";
  byId("turn-title").textContent = winner ? (race.difficulty ? (winner === players[0] ? "Tu as gagné !" : "L’IA a gagné !") :
    `${winner.name} gagne !`) : player.name;
  byId("turn-message").textContent = winner ? `${race.lapCount} ${race.lapCount === 1 ? "tour terminé" : "tours terminés"}.` :
    aiTurn ? `Niveau ${levels[race.difficulty].toLowerCase()}` :
    legal.length ? "Choisis un déplacement." : "Aucun déplacement possible.";
  if (!race.started) {
    byId("turn-label").textContent = "Avant le départ";
    byId("turn-title").textContent = "Course prête";
    byId("turn-message").textContent = "Choisis tes réglages, puis lance la course.";
  }
  byId("pass").hidden = Boolean(!race.started || winner || aiTurn || legal.length);
  trackPass.hidden = byId("pass").hidden;
  if (trackDialog.open) {
    byId("track-status").textContent = winner ? byId("turn-title").textContent :
      !race.started ? "Lance la course depuis les réglages." :
      aiTurn ? "Tour de l’IA" : `${player.name} · Tour ${player.laps + 1}/${race.lapCount}`;
  }
  board.querySelectorAll(".target").forEach((target) => target.remove());
  byId("players").replaceChildren(...players.map((entry, index) => {
    const row = document.createElement("li");
    if (index === active) row.className = "active";
    row.style.setProperty("--player", entry.color);
    const dot = document.createElement("i");
    dot.className = "dot";
    const speed = document.createElement("span");
    const lap = Math.min(entry.laps + 1, race.lapCount);
    speed.textContent = `Tour ${lap}/${race.lapCount} · ${entry.speed} car. / tour`;
    row.append(dot, entry.name, speed);
    return row;
  }));

  const table = byId("moves");
  table.replaceChildren();
  const directionHeader = ["Vitesse", "Gauche", "Droit", "Droite"];
  const restoring = moves.length === 8;
  if (legal.length && !restoring) {
    for (const heading of directionHeader) {
      const label = document.createElement("span");
      label.textContent = heading;
      table.append(label);
    }
  }
  const targetButtons = new Map();
  for (const [index, move] of (legal.length ? moves : []).entries()) {
    if (!restoring && index % 3 === 0) {
      const label = document.createElement("span");
      label.className = "speed";
      label.textContent = `${move.speed} ${move.speed === 1 ? "carreau" : "carreaux"}`;
      table.append(label);
    }
    const label = `${move.direction.name}, vitesse ${move.speed}, déplacement (${move.to.x - player.x}, ${move.to.y - player.y})`;
    const button = document.createElement("button");
    button.type = "button";
    const arrow = Math.round(Math.atan2(move.to.y - player.y, move.to.x - player.x) / (Math.PI / 4));
    const arrows = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
    button.textContent = move.legal ? arrows[(arrow + 8) % 8] : "·";
    button.disabled = !move.legal;
    button.setAttribute("aria-label", label);
    table.append(button);
    if (!move.legal) continue;

    const key = `${move.to.x},${move.to.y}`;
    let target = targetButtons.get(key);
    if (!target) {
      target = document.createElement("button");
      target.type = "button";
      target.className = "target";
      target.tabIndex = trackDialog.open ? 0 : -1;
      target.title = label;
      target.setAttribute("aria-label", label);
      target.style.left = `${move.to.x / columns * 100}%`;
      target.style.top = `${move.to.y / rows * 100}%`;
      target.style.color = player.color;
      target.addEventListener("click", (event) => {
        play(move);
        if (trackDialog.open && event.detail === 0) trackScroll.focus({ preventScroll: true });
      });
      board.append(target);
      targetButtons.set(key, target);
    }
    const showPreview = () => {
      preview = move;
      button.classList.add("preview");
      target.classList.add("preview");
      draw();
    };
    const clearPreview = () => {
      preview = null;
      button.classList.remove("preview");
      target.classList.remove("preview");
      draw();
    };
    button.addEventListener("click", () => {
      play(move);
      focusTurn();
    });
    button.addEventListener("pointerenter", showPreview);
    button.addEventListener("pointerleave", clearPreview);
    button.addEventListener("focus", showPreview);
    button.addEventListener("blur", clearPreview);
    target.addEventListener("pointerenter", showPreview);
    target.addEventListener("pointerleave", clearPreview);
  }
  draw();
  centerTrack();
}

function centerTrack() {
  const { track, players, active, difficulty, started, winner } = race;
  const car = winner ?? players[difficulty ? 0 : active];
  const position = started ? car : track.finish;
  trackScroll.scrollLeft = board.clientWidth * position.x / columns - trackScroll.clientWidth / 2;
  trackScroll.scrollTop = board.clientHeight * position.y / rows - trackScroll.clientHeight / 2;
}

openTrack.addEventListener("click", () => {
  trackDialog.append(sheet);
  openTrack.hidden = true;
  closeTrack.hidden = locateCar.hidden = byId("track-turn").hidden = false;
  trackDialog.showModal();
  render();
  closeTrack.focus({ preventScroll: true });
});
closeTrack.addEventListener("click", () => trackDialog.close());
trackDialog.addEventListener("close", () => {
  trackHome.prepend(sheet);
  openTrack.hidden = false;
  closeTrack.hidden = locateCar.hidden = byId("track-turn").hidden = true;
  render();
  openTrack.focus({ preventScroll: true });
});
locateCar.addEventListener("click", centerTrack);
trackPass.addEventListener("click", () => {
  pass();
  locateCar.focus({ preventScroll: true });
});

function focusTurn() {
  if (trackDialog.open || (race.difficulty && race.active === 1 && !race.winner)) return;
  const title = byId("turn-title");
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
}

const mode = byId("count");
const difficultySelect = byId("difficulty");
const circuitSelect = byId("circuit");
const lapSelect = byId("laps");
const startButton = byId("start-race");
const stopButton = byId("stop-race");

circuits.forEach(({ name }, index) => {
  circuitSelect.add(new Option(`${index + 1}. ${name}`, String(index + 1)));
});

function selectedTrack() {
  const circuit = circuits[Number(circuitSelect.value) - 1];
  return circuit ? presetTrack(circuit) : generateTrack();
}

circuitSelect.addEventListener("change", () => resetRace(selectedTrack()));
for (const select of [mode, difficultySelect, lapSelect]) {
  select.addEventListener("change", () => resetRace(race.track));
}

byId("setup").addEventListener("submit", (event) => {
  event.preventDefault();
  if (race.started && !race.winner) return;
  resetRace(race.winner ? selectedTrack() : race.track, true);
  focusTurn();
});
stopButton.addEventListener("click", () => {
  resetRace(selectedTrack());
  circuitSelect.focus();
});
byId("pass").addEventListener("click", () => {
  pass();
  focusTurn();
});
resetRace(selectedTrack());
new ResizeObserver(draw).observe(board);
