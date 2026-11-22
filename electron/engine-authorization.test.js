const test = require("node:test");
const assert = require("node:assert/strict");
const { FairnessLock } = require("./fairness-lock");
const { authorizeEngineAnalysis } = require("./engine-authorization");

test("main-process authorization permits spectator analysis for another player's game", () => {
  const lock = new FairnessLock();
  assert.deepEqual(authorizeEngineAnalysis(lock, "spectating"), { authorized: true, context: "spectating" });
});

test("main-process authorization rejects Berserk analysis during the user's active game", () => {
  const lock = new FairnessLock();
  lock.updateGame({ platform: "lichess", gameId: "active-1", status: "started", userIsParticipant: true });
  assert.throws(() => authorizeEngineAnalysis(lock, "spectating"), error => error.code === "ENGINE_LOCKED");
});

test("main-process authorization rejects unapproved contexts", () => {
  assert.throws(() => authorizeEngineAnalysis(new FairnessLock(), "live-play"), error => error.code === "ENGINE_CONTEXT_DENIED");
});
