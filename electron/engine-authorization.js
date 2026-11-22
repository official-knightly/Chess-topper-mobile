function authorizeEngineAnalysis(fairnessLock, context) {
  if (!fairnessLock || typeof fairnessLock.assertCanAnalyze !== "function") {
    throw new TypeError("A main-process fairness lock is required");
  }
  fairnessLock.assertCanAnalyze(context);
  return { authorized: true, context };
}

module.exports = { authorizeEngineAnalysis };
