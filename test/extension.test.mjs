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
  const eventHandlers = new Map();

  const pi = {
    on(name, handler) {
      eventHandlers.set(name, handler);
    },
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

  return { commands, tools, notifications, entries, eventHandlers, ctx };
}

test("extension exposes verification-only commands and strict toggles", async () => {
  const { commands, notifications, ctx } = createCommandTestHarness("commands-session");

  assert.equal(commands.has("quality"), false);

  await commands.get("pi-rindaman").handler("/pi-rindaman on", ctx);
  await commands.get("pi-rindaman").handler("/pi-rindaman mode reviewer", ctx);
  await commands.get("strict").handler("/strict off", ctx);
  await commands.get("strict").handler("/strict maybe", ctx);

  assert.deepEqual(
    notifications.map(({ message, level }) => ({ message, level })),
    [
      { message: "pi-rindaman enabled.", level: "info" },
      { message: "Usage: /pi-rindaman on|off", level: "error" },
      { message: "Strict mode disabled.", level: "info" },
      { message: "Usage: /strict on|off", level: "error" },
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

    assert.equal(result.details.status, "passed");
    assert.match(result.details.command, /^node /);
    assert.match(result.details.command, /bin[\\/]pi-rindaman\.cjs/);
    assert.equal(typeof result.details.checkedAt, "string");
    assert.equal(result.details.exitCode, 0);
    assert.match(result.content[0].text, /Final response allowed:/);
    assert.match(result.content[0].text, /Check freshness:/);
  } finally {
    process.chdir(originalCwd);
  }
});

test("strict off is reflected in status output", async () => {
  const { commands, tools, ctx } = createCommandTestHarness("strict-status-session");

  await commands.get("strict").handler("/strict off", ctx);

  const result = await tools
    .get("pi_rindaman_status")
    .execute("tool-call-3", {}, undefined, undefined, ctx);

  const status = JSON.parse(result.content[0].text);

  assert.equal(status.enabled, false);
  assert.equal(status.strictResponses, false);
  assert.equal(status.finalResponse.allowed, true);
});

test("status requires verification after tracked file changes", async () => {
  const { eventHandlers, tools, ctx } = createCommandTestHarness("dirty-session");

  await eventHandlers.get("tool_call")(
    { toolName: "write", input: { path: "src/example.ts" } },
    ctx,
  );

  const result = await tools
    .get("pi_rindaman_status")
    .execute("tool-call-4", {}, undefined, undefined, ctx);

  const status = JSON.parse(result.content[0].text);

  assert.equal(status.verificationRequired, true);
  assert.equal(status.checkFreshness, "not_run");
  assert.equal(status.finalResponse.allowed, false);
  assert.equal(status.nextAction.command, "pi_rindaman_check");
});

test("successful check makes status fresh", async () => {
  const originalCwd = process.cwd();
  const { eventHandlers, tools, ctx } = createCommandTestHarness("fresh-check-session");

  await eventHandlers.get("tool_call")(
    { toolName: "write", input: { path: "src/example.ts" } },
    ctx,
  );

  process.chdir(minimalFixtureDirectory);

  try {
    await tools
      .get("pi_rindaman_check")
      .execute("tool-call-5", { json: true }, undefined, undefined, ctx);
  } finally {
    process.chdir(originalCwd);
  }

  const result = await tools
    .get("pi_rindaman_status")
    .execute("tool-call-6", {}, undefined, undefined, ctx);

  const status = JSON.parse(result.content[0].text);

  assert.equal(status.checkFreshness, "fresh");
  assert.equal(typeof status.finalResponse.allowed, "boolean");
  assert.equal(status.lastCheck.status, "passed");
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
  assert.equal(status.nextAction.command, "pi_rindaman_check");
  assert.equal(typeof status.nextAction.reason, "string");
  assert.ok(status.lastCheck);
  assert.equal(typeof status.lastCheck.status, "string");
  assert.ok(Array.isArray(status.changedFiles));
  assert.equal(typeof status.finalResponse.allowed, "boolean");
  assert.ok(status.finalResponse);
  assert.equal("mode" in status, false);
  assert.equal("secondaryLayer" in status, false);
  assert.equal("seniorEngineer" in status, false);
  assert.equal("reviewer" in status, false);
});
