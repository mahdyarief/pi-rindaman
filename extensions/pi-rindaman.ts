import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { runCheckTool } from "./pi-rindaman/check-tool.ts";
import {
  getToggle,
  stripCommandPrefix,
} from "./pi-rindaman/command-parsing.ts";
import { RINDAMAN_RULE } from "./pi-rindaman/constants.ts";
import { createFinalResponseGate } from "./pi-rindaman/gating.ts";
import {
  addChangedFile,
  getSessionEnabled,
  getSessionId,
  getSessionState,
  persistState,
  restoreState,
  setSessionEnabled,
  updateChangedFiles,
} from "./pi-rindaman/state.ts";
import {
  createCheckSummaryText,
  createStatusPayload,
} from "./pi-rindaman/status.ts";
import type { CheckToolParams } from "./pi-rindaman/types.ts";

export default function piRindaman(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx);
  });

  pi.on("input", async (event, ctx) => {
    const toggle = getToggle(event.text ?? "");
    if (typeof toggle !== "boolean") return { action: "continue" };

    const sessionId = getSessionId(ctx);
    setSessionEnabled(sessionId, toggle);
    persistState(pi, sessionId);
    if (ctx.hasUI)
      ctx.ui.notify(`pi-rindaman ${toggle ? "enabled" : "disabled"}.`, "info");
    return { action: "handled" };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const sessionId = getSessionId(ctx);
    const enabled = getSessionEnabled(sessionId);
    persistState(pi, sessionId);
    if (!enabled) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${RINDAMAN_RULE}` };
  });

  pi.on("tool_call", async (event, ctx) => {
    const sessionId = getSessionId(ctx);
    const state = getSessionState(sessionId);

    if (event.toolName === "write" || event.toolName === "edit") {
      const path =
        typeof event.input.path === "string" ? event.input.path : undefined;
      addChangedFile(state, path);
    }

    if (event.toolName === "bash") {
      const command =
        typeof event.input.command === "string" ? event.input.command : "";
      if (
        /\bgit\s+(commit|push)\b/.test(command) ||
        /\bgh\s+pr\s+create\b/.test(command)
      ) {
        const enabled = getSessionEnabled(sessionId);
        const finalResponse = createFinalResponseGate(state, enabled);
        if (!finalResponse.allowed) {
          return {
            block: true,
            reason: `pi-rindaman: ${finalResponse.reason}. Run pi_rindaman_check first.`,
          };
        }
      }
    }

    persistState(pi, sessionId);
    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;
    const sessionId = getSessionId(ctx);
    updateChangedFiles(getSessionState(sessionId), ctx.cwd);
    persistState(pi, sessionId);
    return undefined;
  });

  pi.registerCommand("pi-rindaman", {
    description: "Toggle pi-rindaman verification mode: on|off",
    handler: async (args, ctx) => {
      const sessionId = getSessionId(ctx);
      const trimmed = stripCommandPrefix(args, "pi-rindaman");

      if (trimmed === "") {
        const enabled = getSessionEnabled(sessionId);
        ctx.ui.notify(
          `pi-rindaman is ${enabled ? "enabled" : "disabled"}. Use /pi-rindaman on|off. Run pi_rindaman_status for session state.`,
          "info",
        );
        return;
      }

      if (trimmed === "on") {
        setSessionEnabled(sessionId, true);
        persistState(pi, sessionId);
        ctx.ui.notify("pi-rindaman enabled.", "info");
        return;
      }
      if (trimmed === "off") {
        setSessionEnabled(sessionId, false);
        persistState(pi, sessionId);
        ctx.ui.notify("pi-rindaman disabled.", "info");
        return;
      }

      ctx.ui.notify("Usage: /pi-rindaman on|off", "error");
    },
  });

  pi.registerCommand("strict", {
    description: "Alias for /pi-rindaman on|off",
    handler: async (args, ctx) => {
      const value = stripCommandPrefix(args, "strict");
      const sessionId = getSessionId(ctx);
      if (value === "on" || value === "off") {
        setSessionEnabled(sessionId, value === "on");
        persistState(pi, sessionId);
        ctx.ui.notify(
          `Strict mode ${value === "on" ? "enabled" : "disabled"}.`,
          "info",
        );
        return;
      }
      ctx.ui.notify("Usage: /strict on|off", "error");
    },
  });

  pi.registerTool({
    name: "pi_rindaman_check",
    label: "pi-rindaman Check",
    description:
      "Run pi-rindaman quality verification from the current project directory and record session check status.",
    parameters: Type.Object({
      mode: Type.Optional(
        Type.Union(
          [
            Type.Literal("check"),
            Type.Literal("audit"),
            Type.Literal("doctor"),
          ],
          {
            default: "check",
          },
        ),
      ),
      json: Type.Optional(Type.Boolean({ default: false })),
      strict: Type.Optional(Type.Boolean({ default: false })),
      report: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sessionId = getSessionId(ctx);
      const state = getSessionState(sessionId);
      const { commandArgs, result } = runCheckTool(
        ctx.cwd,
        params as CheckToolParams,
      );

      updateChangedFiles(state, ctx.cwd);
      state.lastCheckAt = new Date().toISOString();
      state.lastCheckCommand = ["node", ...commandArgs].join(" ");
      state.lastCheckExitCode = result.status;
      state.dirtySinceCheck = false;
      state.lastCheckStatus = result.error
        ? "error"
        : result.status === 0
          ? "passed"
          : "failed";
      persistState(pi, sessionId);

      const enabled = getSessionEnabled(sessionId);

      return {
        content: [
          {
            type: "text",
            text: createCheckSummaryText(
              result.stdout ?? "",
              result.stderr ?? "",
              state,
              enabled,
            ),
          },
        ],
        details: {
          status: state.lastCheckStatus,
          command: state.lastCheckCommand,
          checkedAt: state.lastCheckAt,
          exitCode: state.lastCheckExitCode,
        },
      };
    },
  });

  pi.registerTool({
    name: "pi_rindaman_status",
    label: "pi-rindaman Status",
    description:
      "Report pi-rindaman session state, changed files, and the last quality check result.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sessionId = getSessionId(ctx);
      const state = getSessionState(sessionId);
      updateChangedFiles(state, ctx.cwd);

      const enabled = getSessionEnabled(sessionId);
      const status = createStatusPayload(state, enabled);

      persistState(pi, sessionId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2),
          },
        ],
        details: {
          enabled,
        },
      };
    },
  });
}
