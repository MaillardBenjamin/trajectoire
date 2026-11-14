"use strict";

function drivingKey({ x, y, dx, dy, speed, checked, restarting }) {
  const heading = speed === 0 ? Math.round(headingOnSquare(dx, dy) * 1024) : 0;
  return [x, y, speed ? dx : heading, speed ? dy : 0, speed, checked, Number(restarting)].join(",");
}

function referenceTimes(track, start, maxSpeed) {
  // Each edge costs one turn. A reverse breadth-first search from the finish
  // gives the shortest continuation for every reachable driving state.
  const states = [];
  const indices = new Map();
  const predecessors = [[]];
  function indexOf(player) {
    if (player.won) return 0;
    const key = drivingKey(player);
    if (!indices.has(key)) {
      indices.set(key, states.length + 1);
      states.push(player);
      predecessors.push([]);
    }
    return indices.get(key);
  }
  indexOf(start);
  for (let index = 0; index < states.length; index++) {
    const player = states[index];
    const state = { track, active: 0, players: [player] };
    const moves = getMoves(state).filter(({ legal }) => legal);
    const alternatives = player.restarting ?
      getMoves(state, true).filter(({ legal }) => legal) : moves;
    for (const move of alternatives) {
      if (move.speed <= maxSpeed) {
        const next = indexOf(afterMove(track, player, move));
        if (alternatives === moves || moves.some(({ to }) => to.x === move.to.x && to.y === move.to.y)) {
          predecessors[next].push(index + 1);
        }
      }
    }
    // A blocked lane in a duel can lead to a restart from any legal position.
    // Only model the pass as a reference edge when the track itself forces it.
    if (!player.restarting) {
      const stopped = indexOf(afterPass(player));
      if (moves.length === 0) predecessors[stopped].push(index + 1);
    }
  }

  const turns = new Int32Array(predecessors.length).fill(-1);
  const queue = [0];
  turns[0] = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const next = queue[cursor];
    for (const previous of predecessors[next]) {
      if (turns[previous] !== -1) continue;
      turns[previous] = turns[next] + 1;
      queue.push(previous);
    }
  }
  return (player) => {
    if (player.won) return 0;
    const time = turns[indices.get(drivingKey(player))];
    return time >= 0 ? time : 999;
  };
}

function roadMargin(track, p) {
  let nearest = Infinity;
  for (const { from, ux, uy, length } of track.segments) {
    const x = p.x - from.x;
    const y = p.y - from.y;
    const along = Math.max(0, Math.min(length, x * ux + y * uy));
    nearest = Math.min(nearest, (x - along * ux) ** 2 + (y - along * uy) ** 2);
  }
  return track.radius - Math.sqrt(nearest);
}

function createOpponent(track, start, difficulty) {
  const pace = { easy: 2, medium: 3, hard: Infinity }[difficulty];
  const estimate = referenceTimes(track, start, pace);
  const legalMoves = (player, other) => getMoves({ track, active: 0, players: [player, other] })
    .filter(({ legal }) => legal);

  function duelCost(next, human) {
    const responses = legalMoves(human, next);
    const outcomes = responses.length ? responses.map((move) => afterMove(track, human, move)) : [afterPass(human)];
    // Check every immediate reply, including a finish or a blocked exit.
    let worst = -Infinity;
    for (const reply of outcomes) {
      if (reply.won && (human.laps ?? 0) + 1 >= (human.lapCount ?? 1)) return 1200;
      const exits = legalMoves(next, reply);
      const cost = exits.length ?
        Math.min(...exits.map((move) => estimate(afterMove(track, next, move)))) :
        1 + estimate(afterPass(next));
      // Prefer positions that still leave a good exit even if the human
      // takes the most inconvenient intersection.
      worst = Math.max(worst, cost + (reply.speed === 0 ? -0.12 : 0));
    }
    return worst;
  }

  return ([human, player]) => {
    const legal = legalMoves(player, human);
    const withinPace = legal.filter(({ speed }) => speed <= pace);
    const moves = withinPace.length ? withinPace : legal;
    let best;
    let bestScore = Infinity;
    for (const move of moves) {
      const next = afterMove(track, player, move);
      if (next.won) return move.to;
      const time = estimate(next);
      let score = time;
      if (difficulty === "easy") {
        const clearance = Math.min(roadMargin(track, next), roadMargin(track, between(player, next, 0.5)));
        score += 0.55 * move.speed - 0.55 * clearance;
      } else if (difficulty === "medium") {
        const exits = legalMoves(next, human).filter(({ speed }) => speed <= pace);
        const bestExit = exits.length ?
          Math.min(...exits.map((exit) => estimate(afterMove(track, next, exit)))) :
          1 + estimate(afterPass(next));
        score = 0.65 * time + 0.35 * (1 + bestExit) - 0.24 * roadMargin(track, next);
      } else {
        score = 0.4 * time + 0.6 * (1 + duelCost(next, human));
      }
      if (score < bestScore) {
        best = move;
        bestScore = score;
      }
    }
    return best?.to;
  };
}
