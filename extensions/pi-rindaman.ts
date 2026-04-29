import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type CheckFreshness = "not_run" | "fresh" | "stale";

type SessionQualityState = {
  changedFiles: string[];
  lastCheckAt?: string;
  lastCheckStatus?: "passed" | "failed" | "error";
  lastCheckCommand?: string;
  lastCheckExitCode?: number | null;
  dirtySinceCheck?: boolean;
};

type FinalResponseGate = {
  allowed: boolean;
  reason: string;
};

type CheckToolParams = {
  mode?: "check" | "audit" | "doctor";
  json?: boolean;
  strict?: boolean;
  report?: boolean;
};

const RINDAMAN_STATE_ENTRY = "pi_rindaman_state";

const RINDAMAN_RULE = `
pi-rindaman verification mode is enabled.

pi-rindaman is a verification and response-discipline layer. It does not own planning, orchestration, brainstorming, or workflow methodology.

Strict response behavior:
- Be concise and direct.
- Remove filler, pleasantries, and hedging.
- Preserve technical meaning.
- Prefer short, precise wording.
- Never reduce correctness for brevity.
- Do not compress code blocks, commands, logs, stack traces, exact quoted text, paths, environment variables, API names, URLs, or version numbers.

Verification lifecycle:
1. Before editing: restate the task in one sentence, declare the minimal file footprint, and avoid excluded areas.
2. During implementation: enforce domain naming, explicit types or contracts, simple structure, and no speculative code.
3. Before completion: run verification checks when code changed.
4. After failures: fix root causes, not symptoms. Do not silence checks with casts, ignores, mechanical renames, or unrelated deletion.
5. Before final response: report changed files, checks run, and remaining risks.

Boundaries:
- Workflow planning, decomposition, brainstorming, orchestration, and review process ownership belong to separate workflow packages such as pi-superpowers-plus.
- pi-rindaman owns verification readiness, final-response gating, and quality-check execution.

Before completion:
- Run pi-rindaman from the project root when available and code changed.
- If unavailable, run equivalent project checks: typecheck, formatter or linter, and unused-code detection when configured.
- If verification is required and no passing pi_rindaman_check exists, explicitly state verification is pending or failed.
`.trim();

const extensionDirectory = fileURLToPath(new URL(".", import.meta.url));
const cliPath = () => resolve(extensionDirectory, "..", "bin", "pi-rindaman.cjs");

const sessionStates = new Map<string, SessionQualityState>();
const sessionEnabledStates = new Map<string, boolean>();

const getSessionState = (sessionId: string): SessionQualityState => {
  const existing = sessionStates.get(sessionId);
  if (existing) return existing;
  const initial = { changedFiles: [] };
  sessionStates.set(sessionId, initial);
  return initial;
};

const normalizeCommandText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/^[\s"'`([{]+|[\s"'`)\]}!,.?:;]+$/g, "");

const getNormalizedLines = (text: string) =>
  text.split(/\r?\n/).map(normalizeCommandText).filter(Boolean);

const getLastNormalizedCommandLine = (text: string) => getNormalizedLines(text).at(-1);

const stripCommandPrefix = (text: string, commandName: string) => {
  const normalized = getLastNormalizedCommandLine(text);
  if (!normalized) return "";

  const prefixes = [`/${commandName}`, commandName];
  for (const prefix of prefixes) {
    if (normalized === prefix) return "";
    if (normalized.startsWith(`${prefix} `)) return normalized.slice(prefix.length + 1).trim();
  }

  return normalized;
};

const getToggle = (text: string) => {
  const onCommands = new Set([
    "/pi-rindaman on",
    "pi-rindaman on",
    "/strict on",
    "strict on",
    "strict mode",
    "be strict",
  ]);
  const offCommands = new Set([
    "/pi-rindaman off",
    "pi-rindaman off",
    "/strict off",
    "strict off",
    "normal mode",
    "stop strict",
  ]);

  const full = normalizeCommandText(text);
  if (onCommands.has(full)) return true;
  if (offCommands.has(full)) return false;

  const lines = getNormalizedLines(text);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (onCommands.has(lines[i])) return true;
    if (offCommands.has(lines[i])) return false;
  }

  return undefined;
};

const isVerificationRequired = (state: SessionQualityState) => state.changedFiles.length > 0;

const createFinalResponseGate = (
  state: SessionQualityState,
  enabled: boolean,
): FinalResponseGate => {
  if (!enabled) return { allowed: true, reason: "pi-rindaman disabled" };
  if (!isVerificationRequired(state)) return { allowed: true, reason: "verification not required" };
  if (state.lastCheckStatus === "passed") return { allowed: true, reason: "verification passed" };
  if (state.lastCheckStatus === "failed") return { allowed: false, reason: "verification failed" };
  if (state.lastCheckStatus === "error") return { allowed: false, reason: "verification errored" };
  return { allowed: false, reason: "verification pending" };
};

const getCheckFreshness = (state: SessionQualityState): CheckFreshness => {
  if (!state.lastCheckStatus) return "not_run";
  return state.dirtySinceCheck ? "stale" : "fresh";
};

const getNextAction = (
  verificationRequired: boolean,
  checkFreshness: CheckFreshness,
  finalResponse: FinalResponseGate,
) => {
  if (checkFreshness === "not_run") {
    return {
      command: "pi_rindaman_check",
      reason: "verification has not been run for this session",
    };
  }

  if (verificationRequired && checkFreshness === "stale") {
    return {
      command: "pi_rindaman_check",
      reason: "files changed after the last verification",
    };
  }

  if (!finalResponse.allowed) {
    return {
      command: "pi_rindaman_check",
      reason: finalResponse.reason,
    };
  }

  return {
    command: null,
    reason: "no action required",
  };
};

const readChangedFiles = (directory: string) => {
  const gitStatus = spawnSync("git", ["status", "--porcelain"], {
    cwd: directory,
    encoding: "utf8",
  });

  if (gitStatus.status !== 0 || !gitStatus.stdout) return [];

  return gitStatus.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
};

const persistState = (pi: ExtensionAPI, sessionId: string) => {
  pi.appendEntry(RINDAMAN_STATE_ENTRY, {
    sessionId,
    quality: sessionStates.get(sessionId),
    enabled: sessionEnabledStates.get(sessionId) ?? true,
  });
};

const restoreState = (ctx: ExtensionContext) => {
  const sessionId = ctx.sessionManager.getSessionFile() ?? "default";
  for (let i = ctx.sessionManager.getBranch().length - 1; i >= 0; i -= 1) {
    const entry = ctx.sessionManager.getBranch()[i];
    if (entry.type !== "custom" || entry.customType !== RINDAMAN_STATE_ENTRY) continue;
    const data = entry.data as {
      sessionId?: string;
      quality?: SessionQualityState;
      enabled?: boolean;
    };
    if (data.quality) sessionStates.set(sessionId, data.quality);
    sessionEnabledStates.set(sessionId, data.enabled ?? true);
    return;
  }
  getSessionState(sessionId);
  sessionEnabledStates.set(sessionId, true);
};

const getSessionId = (ctx: ExtensionContext) => ctx.sessionManager.getSessionFile() ?? "default";

const updateChangedFiles = (state: SessionQualityState, cwd: string) => {
  const changedFiles = readChangedFiles(cwd);
  if (changedFiles.length > 0) state.changedFiles = changedFiles;
};

const buildCheckCommandArgs = (params: CheckToolParams) => {
  const mode = params.mode ?? "check";
  const commandArgs = [cliPath()];

  if (mode !== "check") commandArgs.push(mode);
  if (params.json) commandArgs.push("--json");
  if (params.strict) commandArgs.push("--strict");
  if (params.report) commandArgs.push("--report");

  return commandArgs;
};

export default function piRindaman(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx);
  });

  pi.on("input", async (event, ctx) => {
    const toggle = getToggle(event.text ?? "");
    if (typeof toggle !== "boolean") return { action: "continue" };

    const sessionId = getSessionId(ctx);
    sessionEnabledStates.set(sessionId, toggle);
    persistState(pi, sessionId);
    if (ctx.hasUI) ctx.ui.notify(`pi-rindaman ${toggle ? "enabled" : "disabled"}.`, "info");
    return { action: "handled" };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const sessionId = getSessionId(ctx);
    const enabled = sessionEnabledStates.get(sessionId) ?? true;
    persistState(pi, sessionId);
    if (!enabled) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${RINDAMAN_RULE}` };
  });

  pi.on("tool_call", async (event, ctx) => {
    const sessionId = getSessionId(ctx);
    const state = getSessionState(sessionId);

    if (event.toolName === "write" || event.toolName === "edit") {
      const path = typeof event.input.path === "string" ? event.input.path : undefined;
      if (path && !state.changedFiles.includes(path)) state.changedFiles.push(path);
      state.dirtySinceCheck = true;
    }

    if (event.toolName === "bash") {
      const command = typeof event.input.command === "string" ? event.input.command : "";
      if (/\bgit\s+(commit|push)\b/.test(command) || /\bgh\s+pr\s+create\b/.test(command)) {
        const enabled = sessionEnabledStates.get(sessionId) ?? true;
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

      if (trimmed === "on") {
        sessionEnabledStates.set(sessionId, true);
        persistState(pi, sessionId);
        ctx.ui.notify("pi-rindaman enabled.", "info");
        return;
      }
      if (trimmed === "off") {
        sessionEnabledStates.set(sessionId, false);
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
        sessionEnabledStates.set(sessionId, value === "on");
        persistState(pi, sessionId);
        ctx.ui.notify(`Strict mode ${value === "on" ? "enabled" : "disabled"}.`, "info");
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
        Type.Union([Type.Literal("check"), Type.Literal("audit"), Type.Literal("doctor")], {
          default: "check",
        }),
      ),
      json: Type.Optional(Type.Boolean({ default: false })),
      strict: Type.Optional(Type.Boolean({ default: false })),
      report: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sessionId = getSessionId(ctx);
      const state = getSessionState(sessionId);
      const commandArgs = buildCheckCommandArgs(params as CheckToolParams);
      const result = spawnSync("node", commandArgs, {
        cwd: ctx.cwd,
        encoding: "utf8",
      });

      updateChangedFiles(state, ctx.cwd);
      state.lastCheckAt = new Date().toISOString();
      state.lastCheckCommand = ["node", ...commandArgs].join(" ");
      state.lastCheckExitCode = result.status;
      state.dirtySinceCheck = false;
      state.lastCheckStatus = result.error ? "error" : result.status === 0 ? "passed" : "failed";
      persistState(pi, sessionId);

      const finalResponse = createFinalResponseGate(
        state,
        sessionEnabledStates.get(sessionId) ?? true,
      );
      const checkFreshness = getCheckFreshness(state);
      const nextAction = getNextAction(
        isVerificationRequired(state),
        checkFreshness,
        finalResponse,
      );

      return {
        content: [
          {
            type: "text",
            text: [
              result.stdout,
              result.stderr,
              "",
              `pi-rindaman status: ${state.lastCheckStatus}`,
              `Exit code: ${String(result.status)}`,
              `Final response allowed: ${String(finalResponse.allowed)}`,
              `Final response reason: ${finalResponse.reason}`,
              `Check freshness: ${checkFreshness}`,
              `Next action: ${nextAction.command ?? "none"}`,
              `Next action reason: ${nextAction.reason}`,
            ]
              .filter(Boolean)
              .join("\n"),
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

      const enabled = sessionEnabledStates.get(sessionId) ?? true;
      const checkFreshness = getCheckFreshness(state);
      const finalResponse = createFinalResponseGate(state, enabled);
      const nextAction = getNextAction(
        isVerificationRequired(state),
        checkFreshness,
        finalResponse,
      );

      persistState(pi, sessionId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                enabled,
                strictResponses: enabled,
                qualityLifecycle: true,
                verificationRequired: isVerificationRequired(state),
                checkFreshness,
                nextAction,
                changedFiles: state.changedFiles,
                lastCheck: {
                  status: state.lastCheckStatus ?? "not_run",
                  command: state.lastCheckCommand ?? null,
                  checkedAt: state.lastCheckAt ?? null,
                  exitCode: state.lastCheckExitCode ?? null,
                },
                finalResponse,
              },
              null,
              2,
            ),
          },
        ],
        details: {
          enabled,
        },
      };
    },
  });
}
