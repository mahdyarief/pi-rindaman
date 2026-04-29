import assert from "node:assert/strict";
import test from "node:test";

import piRindaman from "../extensions/pi-rindaman.ts";

function createCommandTestHarness() {
  const commands = new Map();
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
    registerTool() {},
  };

  const ctx = {
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

  return { commands, notifications, entries, ctx };
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
