"use strict";

const standardGrid = { columns: 50, rows: 33 };
const largeGrid = { columns: 80, rows: 53 };
const directions = [
  { name: "Gauche", symbol: "↖", turn: -1 },
  { name: "Tout droit", symbol: "↑", turn: 0 },
  { name: "Droite", symbol: "↗", turn: 1 }
];
const epsilon = 1e-7;
const point = (x, y) => ({ x, y });
const between = (a, b, t) => point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const randomInt = (from, to) => from + Math.floor(Math.random() * (to - from + 1));

// Insets are listed in driving order along the bottom straight.
const circuits = [
  { name: "L’Anneau", radius: 3.5, bend: 8, insets: [] },
  { name: "Les Quatre Virages", radius: 3.1, bend: 5, insets: [] },
  { name: "La Boucle serrée", radius: 2.7, bend: 3, insets: [] },
  { name: "Le Décroché", radius: 3.2, bend: 5, insets: [[34, 21, 8, 4]] },
  { name: "La Chicane", radius: 2.9, bend: 5, insets: [[35, 22, 10, 3]] },
  { name: "Le Virage en U", radius: 2.65, bend: 4, insets: [[34, 25, 12, 3]] },
  { name: "Le Double Décroché", radius: 2.6, bend: 5, insets: [[38, 30, 8, 3], [22, 14, 8, 3]] },
  { name: "L’Épingle", radius: 2.4, bend: 3, insets: [[34, 26, 14, 2]] },
  { name: "Les Virages enchaînés", radius: 2.35, bend: 4, insets: [[38, 30, 12, 3], [22, 14, 10, 2]] },
  { name: "Les Doubles Épingles", radius: 2.15, bend: 3, insets: [[38, 31, 15, 2], [22, 15, 14, 2]] }
];

// Each sector is a sequence of chicanes. The tuple gives entry x, exit x,
// depth toward the infield and corner rounding in grid units.
const largeCircuits = [
  { name: "Le Grand S", radius: 3.1, top: [[46, 59, 10, 4]], bottom: [[64, 52, 14, 4], [32, 19, 12, 4]] },
  { name: "Les Dunes", radius: 3, top: [[41, 52, 8, 3], [59, 68, 12, 3]], bottom: [[57, 44, 15, 3], [33, 19, 11, 4]] },
  { name: "Le Canyon", radius: 2.85, top: [[44, 61, 16, 3]], bottom: [[66, 54, 18, 3], [45, 35, 12, 3], [25, 14, 15, 3]] },
  { name: "Les Terrasses", radius: 2.75, top: [[42, 52, 12, 3], [60, 69, 14, 3]], bottom: [[65, 53, 12, 3], [45, 34, 16, 3], [25, 15, 12, 3]] },
  { name: "Le Col", radius: 2.7, top: [[40, 50, 15, 2], [59, 67, 10, 2]], bottom: [[66, 56, 18, 2], [46, 37, 13, 2], [27, 16, 18, 3]] },
  { name: "Les Lacets", radius: 2.6, top: [[39, 48, 15, 2], [58, 68, 14, 2]], bottom: [[66, 56, 17, 2], [48, 38, 17, 2], [29, 18, 17, 2]], return: [[20, 29, 11, 2]] },
  { name: "Le Labyrinthe", radius: 2.5, top: [[41, 50, 15, 2], [59, 68, 16, 2]], bottom: [[66, 57, 18, 2], [48, 39, 18, 2], [30, 21, 18, 2], [15, 10, 11, 2]] },
  { name: "Les Gorges", radius: 2.4, top: [[40, 49, 16, 2], [57, 65, 16, 2]], bottom: [[67, 58, 19, 2], [49, 41, 19, 2], [33, 24, 19, 2], [16, 10, 15, 2]], return: [[20, 29, 13, 2]] },
  { name: "Le Serpentin", radius: 2.3, top: [[39, 48, 16, 2], [54, 61, 17, 2], [66, 71, 12, 2]], bottom: [[68, 59, 19, 2], [51, 43, 19, 2], [35, 26, 19, 2], [18, 10, 19, 2]], return: [[21, 30, 15, 2]] },
  { name: "Les Épingles du sommet", radius: 2.2, top: [[39, 46, 17, 2], [52, 59, 17, 2], [65, 71, 17, 2]], bottom: [[68, 60, 20, 2], [52, 44, 20, 2], [36, 28, 20, 2], [20, 12, 20, 2]], return: [[10, 15, 12, 2], [22, 30, 16, 2]] }
];

function largeTrack(circuit) {
  const finish = { x: 34, y: 5, dx: 1, dy: 0 };
  const corners = [finish];
  const bends = [0];
  const checkpoints = [];
  const left = 4;
  const right = 76;
  const bottom = 48;

  function add(x, y, bend = 3) {
    corners.push(point(x, y));
    bends.push(bend);
  }

  function addChicanes(chicanes, edge, inward, dx) {
    for (const [entry, exit, depth, bend] of chicanes) {
      const apex = edge + inward * depth;
      add(entry, edge, bend);
      add(entry, apex, bend);
      add(exit, apex, bend);
      add(exit, edge, bend);
      checkpoints.push({ x: (entry + exit) / 2, y: apex, dx, dy: 0 });
    }
  }

  addChicanes(circuit.top, finish.y, 1, 1);
  add(right, finish.y);
  add(right, bottom);
  checkpoints.push({ x: right, y: 26, dx: 0, dy: 1 });
  addChicanes(circuit.bottom, bottom, -1, -1);
  add(left, bottom);
  add(left, finish.y);
  checkpoints.push({ x: left, y: 26, dx: 0, dy: -1 });
  addChicanes(circuit.return ?? [], finish.y, 1, 1);
  corners.push(finish);
  return buildTrack(corners, (index) => bends[index], circuit.radius, checkpoints, finish, largeGrid);
}

function presetTrack({ radius, bend, insets }) {
  const finish = { x: 24, y: 5, dx: 1, dy: 0 };
  const bottom = 28;
  const corners = [finish, point(45, 5), point(45, bottom)];
  const bends = [0, bend, bend];
  const checkpoints = [{ x: 45, y: 16, dx: 0, dy: 1 }];
  for (const [right, left, depth, curve] of insets) {
    const top = bottom - depth;
    corners.push(point(right, bottom), point(right, top), point(left, top), point(left, bottom));
    bends.push(curve, curve, curve, curve);
    checkpoints.push({ x: (right + left) / 2, y: top, dx: -1, dy: 0 });
  }
  corners.push(point(5, bottom), point(5, 5), finish);
  bends.push(bend, bend);
  checkpoints.push({ x: 5, y: 16, dx: 0, dy: -1 });
  return buildTrack(corners, (index) => bends[index], radius, checkpoints, finish);
}

function generateTrack() {
  const top = randomInt(5, 7);
  const bottom = randomInt(26, 28);
  const right = randomInt(40, 45);
  const left = randomInt(5, 10);
  const start = randomInt(20, 29);
  const inlet = randomInt(19, 20);
  const inletLeft = randomInt(23, 25);
  const inletRight = randomInt(32, 34);
  const radius = 2.8;
  const startPoint = point(start, top);
  const corners = [
    startPoint, point(right, top), point(right, bottom),
    point(inletRight, bottom), point(inletRight, inlet),
    point(inletLeft, inlet), point(inletLeft, bottom),
    point(left, bottom), point(left, top), startPoint
  ];
  const checkpoints = [
    { x: right, y: 15, dx: 0, dy: 1 },
    { x: 17, y: bottom, dx: -1, dy: 0 },
    { x: left, y: 15, dx: 0, dy: -1 }
  ];
  const finish = { ...startPoint, dx: 1, dy: 0 };
  const bendAt = (index) => index >= 3 && index <= 6 ? randomInt(2, 3) : randomInt(3, 5);
  return buildTrack(corners, bendAt, radius, checkpoints, finish);
}

function buildTrack(corners, bendAt, radius, checkpoints, finish, grid = standardGrid) {
  const spine = [corners[0]];
  for (let i = 1; i < corners.length - 1; i++) {
    const corner = corners[i];
    const before = corners[i - 1];
    const after = corners[i + 1];
    const incoming = Math.hypot(before.x - corner.x, before.y - corner.y);
    const outgoing = Math.hypot(after.x - corner.x, after.y - corner.y);
    const bend = bendAt(i);
    const maxFraction = grid === largeGrid ? .5 : 1;
    const entry = between(corner, before, Math.min(bend / incoming, maxFraction));
    const exit = between(corner, after, Math.min(bend / outgoing, maxFraction));
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const sample = between(between(entry, corner, t), between(corner, exit, t), t);
      const previous = spine.at(-1);
      if (Math.hypot(sample.x - previous.x, sample.y - previous.y) > epsilon) spine.push(sample);
    }
  }
  spine.push(corners.at(-1));
  const segments = spine.slice(1).map((to, index) => {
    const from = spine[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return { from, length, ux: (to.x - from.x) / length, uy: (to.y - from.y) / length };
  });
  return { ...grid, spine, segments, radius, checkpoints, finish };
}

function slab(origin, delta, low, high) {
  if (Math.abs(delta) < epsilon) {
    return origin >= low - epsilon && origin <= high + epsilon ? [-Infinity, Infinity] : [1, 0];
  }
  const a = (low - origin) / delta;
  const b = (high - origin) / delta;
  return [Math.min(a, b), Math.max(a, b)];
}

const roadCache = new WeakMap();

function onRoad(track, from, to) {
  const { columns, rows } = track;
  if (to.x < 0 || to.x > columns || to.y < 0 || to.y > rows) return false;
  let cache = roadCache.get(track);
  if (!cache) {
    cache = new Map();
    roadCache.set(track, cache);
  }
  const stride = columns + 1;
  const a = from.y * stride + from.x;
  const b = to.y * stride + to.x;
  const key = Math.min(a, b) * stride * (rows + 1) + Math.max(a, b);
  if (!cache.has(key)) cache.set(key, coversSegment(track, from, to));
  return cache.get(key);
}

function coversSegment(track, from, to) {
  // The visible road is the union of rectangles and disks along the centreline.
  // Cover every parameter on the move, including any gap between those shapes.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const intervals = [];
  for (const segment of track.segments) {
    const x = from.x - segment.from.x;
    const y = from.y - segment.from.y;
    const { ux, uy, length } = segment;
    const along = slab(x * ux + y * uy, dx * ux + dy * uy, 0, length);
    const across = slab(y * ux - x * uy, dy * ux - dx * uy, -track.radius, track.radius);
    const low = Math.max(along[0], across[0], 0);
    const high = Math.min(along[1], across[1], 1);
    if (low <= high) intervals.push([low, high]);
  }
  for (const centre of track.spine) {
    const x = from.x - centre.x;
    const y = from.y - centre.y;
    const dot = x * dx + y * dy;
    const discriminant = dot * dot - lengthSquared * (x * x + y * y - track.radius ** 2);
    if (discriminant < 0) continue;
    const root = Math.sqrt(discriminant);
    intervals.push([(-dot - root) / lengthSquared, (-dot + root) / lengthSquared]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  for (const [low, high] of intervals) {
    if (low > covered + epsilon) return false;
    covered = Math.max(covered, high);
    if (covered >= 1 - epsilon) return true;
  }
  return false;
}

function gateCrossing(gate, radius, from, to) {
  const ahead = (p) => (p.x - gate.x) * gate.dx + (p.y - gate.y) * gate.dy;
  const before = ahead(from);
  const after = ahead(to);
  if ((before >= 0) === (after >= 0)) return null;
  const t = before / (before - after);
  const hit = between(from, to, t);
  const lateral = (hit.y - gate.y) * gate.dx - (hit.x - gate.x) * gate.dy;
  return Math.abs(lateral) <= radius + epsilon ? { t, forward: after >= 0 } : null;
}

function lapProgress(track, player, to) {
  const gates = [...track.checkpoints, track.finish];
  let checked = player.checked;
  const crossings = gates.flatMap((gate, index) => {
    const crossing = gateCrossing(gate, track.radius, player, to);
    return crossing ? [{ ...crossing, index }] : [];
  }).sort((a, b) => a.t - b.t);

  for (const { index, forward } of crossings) {
    if (index === track.checkpoints.length) {
      if (forward && checked === index) return { checked, won: true };
      checked = 0;
    } else if (forward && index === checked) {
      checked++;
    } else if (!forward && index === checked - 1) {
      checked--;
    }
  }
  return { checked, won: false };
}

function headingOnSquare(dx, dy) {
  const scale = Math.max(Math.abs(dx), Math.abs(dy));
  const x = dx / scale;
  const y = dy / scale;
  if (x === 1) return y;
  if (y === 1) return 2 - x;
  if (x === -1) return 4 - y;
  return 6 + x;
}

function stepOnSquare(speed, index) {
  const position = ((index + speed) % (8 * speed) + 8 * speed) % (8 * speed);
  if (position <= 2 * speed) return point(speed, position - speed);
  if (position <= 4 * speed) return point(3 * speed - position, speed);
  if (position <= 6 * speed) return point(-speed, 5 * speed - position);
  return point(position - 7 * speed, -speed);
}

function getMoves(state, includeAlternativeStarts = false) {
  const player = state.players[state.active];
  const speeds = player.speed === 0 ? [1] :
    player.speed === 1 ? [1, 2] : [player.speed - 1, player.speed, player.speed + 1];
  const heading = headingOnSquare(player.dx, player.dy);
  const makeMove = (speed, direction, index) => {
    const step = stepOnSquare(speed, index);
    const to = point(player.x + step.x, player.y + step.y);
    const occupied = state.players.some((other) => !other.eliminated && other.x === to.x && other.y === to.y);
    return { speed, direction, to, legal: !occupied && onRoad(state.track, player, to) };
  };
  // At fixed speed the previous vector is one point on the surrounding square.
  // Each turn shifts the endpoint by one lattice step along that square.
  const moves = speeds.flatMap((speed) => directions.map((direction) =>
    makeMove(speed, direction, Math.round(heading * speed) + direction.turn)
  ));
  if (!player.restarting || (!includeAlternativeStarts && moves.some((move) => move.legal))) return moves;

  return [
    ["Est", "→"], ["Sud-est", "↘"], ["Sud", "↓"], ["Sud-ouest", "↙"],
    ["Ouest", "←"], ["Nord-ouest", "↖"], ["Nord", "↑"], ["Nord-est", "↗"]
  ].map(([name, symbol], index) => makeMove(1, { name, symbol }, index));
}

function afterMove(track, player, move) {
  const { checked, won } = lapProgress(track, player, move.to);
  return {
    ...move.to, dx: move.to.x - player.x, dy: move.to.y - player.y,
    speed: move.speed, restarting: false, checked, won
  };
}

function afterPass(player) {
  return { ...player, speed: 0, restarting: true };
}

function tooFastToMove(track, player) {
  return player.speed > 1 && !getMoves({ track, players: [player], active: 0 }).some(({ legal }) => legal);
}
