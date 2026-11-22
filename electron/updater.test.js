const test = require("node:test");
const assert = require("node:assert/strict");
const { validateReleaseUrl, checkForUpdate } = require("./updater");

test("accepts HTTPS GitHub release endpoints only", () => {
  assert.equal(validateReleaseUrl("https://api.github.com/repos/owner/app/releases/latest"), "https://api.github.com/repos/owner/app/releases/latest");
  assert.throws(() => validateReleaseUrl("http://api.github.com/releases"), /HTTPS/);
  assert.throws(() => validateReleaseUrl("https://example.com/releases"), /GitHub/);
});

test("reports a newer release from the mocked GitHub API", async () => {
  const result = await checkForUpdate({
    releaseApiUrl: "https://api.github.com/repos/owner/app/releases/latest",
    currentVersion: "0.1.0",
    fetchImpl: async () => ({ ok: true, json: async () => ({ tag_name: "v1.0.1", html_url: "https://github.com/owner/app/releases/tag/v1.0.1" }) })
  });
  assert.equal(result.available, true);
  assert.equal(result.latestVersion, "1.0.1");
});
