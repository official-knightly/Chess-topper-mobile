const test = require("node:test");
const assert = require("node:assert/strict");
const { FairnessLock } = require("./fairness-lock");

test("rejects analysis while the user is in an active online game", () => {
  const lock = new FairnessLock();
  lock.updateGame({ platform: "lichess", gameId: "abc", status: "started", userIsParticipant: true });
  assert.equal(lock.isLocked(), true);
  assert.throws(() => lock.assertCanAnalyze("analysis-board"), error => error.code === "ENGINE_LOCKED");
});

test("unlocks automatically when the game ends", () => {
  const lock = new FairnessLock();
  lock.updateGame({ platform: "lichess", gameId: "abc", status: "started", userIsParticipant: true });
  lock.updateGame({ platform: "lichess", gameId: "abc", status: "finished", userIsParticipant: true });
  assert.equal(lock.isLocked(), false);
  assert.doesNotThrow(() => lock.assertCanAnalyze("analysis-board"));
});

test("spectating another player's game does not lock analysis", () => {
  const lock = new FairnessLock();
  lock.updateGame({ platform: "lichess", gameId: "tv-1", status: "started", userIsParticipant: false });
  assert.equal(lock.isLocked(), false);
  assert.doesNotThrow(() => lock.assertCanAnalyze("spectating"));
});

test("one finished game does not unlock another active participant game", () => {
  const lock = new FairnessLock();
  lock.updateGame({ platform: "lichess", gameId: "a", status: "started", userIsParticipant: true });
  lock.updateGame({ platform: "chesscom", gameId: "b", status: "started", userIsParticipant: true });
  lock.updateGame({ platform: "lichess", gameId: "a", status: "finished", userIsParticipant: true });
  assert.throws(() => lock.assertCanAnalyze("finished-review"), error => error.code === "ENGINE_LOCKED");
});

test("rejects engine use from unapproved contexts even when no game is active", () => {
  const lock = new FairnessLock();
  assert.throws(() => lock.assertCanAnalyze("live-play"), error => error.code === "ENGINE_CONTEXT_DENIED");
  assert.throws(() => lock.assertCanAnalyze(), error => error.code === "ENGINE_CONTEXT_DENIED");
});

test("fails closed while a connected platform game status cannot be verified", () => {
  const lock = new FairnessLock();
  lock.setMonitoring("lichess", false);
  assert.equal(lock.isLocked(), true);
  assert.throws(() => lock.assertCanAnalyze("analysis-board"), error => error.code === "FAIRNESS_UNVERIFIED");
  lock.setMonitoring("lichess", true);
  assert.equal(lock.isLocked(), false);
  assert.doesNotThrow(() => lock.assertCanAnalyze("analysis-board"));
});
