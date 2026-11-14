"use strict";

importScripts("engine.js", "opponent.js");

let chooseMove;
self.addEventListener("message", ({ data }) => {
  if (data.track) {
    chooseMove = createOpponent(data.track, data.start, data.difficulty);
    return;
  }
  self.postMessage(chooseMove(data.players));
});
