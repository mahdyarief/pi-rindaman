import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import piRindaman from "../extensions/pi-rindaman.ts";

const minimalFixtureDirectory = resolve(import.meta.dirname, "fixtures", "minimal-project");

function createCommandTestHarness(sessionId = "test-session") {
  const commands = new Map();
  const tools = new Map();
  const notifications = [];
  const entries = [];

  const pi = {
    on() {},
    appendEntry(_type, data) {
      entries.push(data);
    },
    registerCommand(name, config) {
      commands.set(name, config);
    },
    registerTool(config) {
      tools.set(config.name, config);
    },
  };

  const ctx = {
    cwd: minimalFixtureDirectory,
    hasUI: true,
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
    },
    sessionManager: {
      getSessionFile() {
        return sessionId;
      },
      getBranch() {
        return [];
      },
    },
  };

  piRindaman(pi);

  return { commands, tools, notifications, entries, ctx };
}

test("extension exposes verification-only commands and strict toggles", async () => {
  const { commands, notifications, ctx } = createCommandTestHarness("commands-session");

  assert.equal(commands.has("quality"), false);

  await commands.get("pi-rindaman").handler("/pi-rindaman on", ctx);
  await commands.get("pi-rindaman").handler("/pi-rindaman mode reviewer", ctx);
  await commands.get("strict").handler("/strict off", ctx);

  assert.deepEqual(
    notifications.map(({ message, level }) => ({ message, level })),
    [
      { message: "pi-rindaman enabled.", level: "info" },
      { message: "Usage: /pi-rindaman on|off", level: "error" },
      { message: "Strict mode disabled.", level: "info" },
    ],
  );
});

test("pi_rindaman_check resolves the bundled CLI outside the active repo", async () => {
  const originalCwd = process.cwd();
  const { tools, ctx } = createCommandTestHarness("check-session");

  process.chdir(minimalFixtureDirectory);

  try {
    const result = await tools
      .get("pi_rindaman_check")
      .execute("tool-call-1", { json: true }, undefined, undefined, ctx);

    assert.match(result.details.command, /bin[\\/]pi-rindaman\.cjs/);
    assert.equal(result.details.status, "passed");
  } finally {
    process.chdir(originalCwd);
  }
});

test("pi_rindaman_status reports verification-only status semantics", async () => {
  const { tools, ctx } = createCommandTestHarness("status-session");

  const result = await tools
    .get("pi_rindaman_status")
    .execute("tool-call-2", {}, undefined, undefined, ctx);

  const status = JSON.parse(result.content[0].text);

  assert.equal(status.enabled, true);
  assert.equal(status.strictResponses, true);
  assert.equal(status.qualityLifecycle, true);
  assert.equal(typeof status.verificationRequired, "boolean");
  assert.equal(typeof status.checkFreshness, "string");
  assert.ok(status.lastCheck);
  assert.ok(status.finalResponse);
  assert.equal("mode" in status, false);
  assert.equal("secondaryLayer" in status, false);
  assert.equal("seniorEngineer" in status, false);
  assert.equal("reviewer" in status, false);
});
