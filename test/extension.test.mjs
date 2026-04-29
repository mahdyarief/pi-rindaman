import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import piRindaman from "../extensions/pi-rindaman.ts";

const minimalFixtureDirectory = resolve(import.meta.dirname, "fixtures", "minimal-project");

function createCommandTestHarness() {
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
        return "test-session";
      },
      getBranch() {
        return [];
      },
    },
  };

  piRindaman(pi);

  return { commands, tools, notifications, entries, ctx };
}

test("slash command handlers accept full command text arguments", async () => {
  const { commands, notifications, ctx } = createCommandTestHarness();

  await commands.get("pi-rindaman").handler("/pi-rindaman on", ctx);
  await commands.get("pi-rindaman").handler("/pi-rindaman mode reviewer", ctx);
  await commands.get("quality").handler("/quality on", ctx);
  await commands.get("strict").handler("/strict off", ctx);

  assert.deepEqual(
    notifications.map(({ message, level }) => ({ message, level })),
    [
      { message: "pi-rindaman enabled.", level: "info" },
      { message: "pi-rindaman mode: reviewer.", level: "info" },
      { message: "pi-rindaman enabled.", level: "info" },
      { message: "Strict mode disabled.", level: "info" },
    ],
  );
});

test("pi_rindaman_check resolves the bundled CLI outside the active repo", async () => {
  const originalCwd = process.cwd();
  const { tools, ctx } = createCommandTestHarness();

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
