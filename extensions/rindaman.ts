import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"

type RindamanMode = "core" | "senior" | "reviewer" | "auto"
type SecondaryLayer = "none" | "senior" | "reviewer"
type CheckFreshness = "not_run" | "fresh" | "stale"

type SessionQualityState = {
  changedFiles: string[]
  lastCheckAt?: string
  lastCheckStatus?: "passed" | "failed" | "error"
  lastCheckCommand?: string
  lastCheckExitCode?: number | null
  dirtySinceCheck?: boolean
}

type SeniorEngineerActivation = {
  active: boolean
  intent: "implementation" | "review" | "none"
  reason: string
  intentSource: "forced-mode" | "auto-signals" | "none"
  matchedSignals: string[]
}

type FinalResponseGate = {
  allowed: boolean
  reason: string
}

const RINDAMAN_STATE_ENTRY = "rindaman_state"

const RINDAMAN_RULE = `
rindaman lifecycle and strict response mode is enabled.

Rindaman combines strict response behavior with lifecycle code quality control.

Strict response behavior:
- Be concise and direct.
- Remove filler, pleasantries, and hedging.
- Preserve technical meaning.
- Prefer short, precise wording.
- Never reduce correctness for brevity.
- Do not compress code blocks, commands, logs, stack traces, exact quoted text, paths, environment variables, API names, URLs, or version numbers.

Code quality lifecycle:
1. Before editing: restate the task in one sentence, declare the minimal file footprint, and avoid excluded areas.
2. During implementation: enforce domain naming, explicit types/contracts, simple structure, and no speculative code.
3. Before completion: run verification checks when code changed.
4. After failures: fix root causes, not symptoms. Do not silence checks with casts, ignores, mechanical renames, or unrelated deletion.
5. Before final response: report changed files, checks run, and remaining risks.

Before completion:
- Run rindaman from the project root when available and code changed.
- If unavailable, run equivalent project checks: typecheck, formatter or linter, and unused-code detection when configured.
- If verification is required and no passing rindaman_check exists, explicitly state verification is pending or failed.
`.trim()

const RINDAMAN_SENIOR_RULE = `
rindaman senior fullstack implementation mode is enabled.

This layer adds framework-agnostic web-product engineering doctrine.

- Organize by feature or domain, not by generic layer dumping grounds.
- Keep UI, application logic, domain rules, and infrastructure boundaries explicit.
- Validate untrusted inputs at boundaries.
- Prefer typed contracts for reads and mutations.
- Treat server-side authorization as the source of truth.
- Prefer integration evidence over mock-heavy confidence theater.
`.trim()

const RINDAMAN_REVIEWER_RULE = `
rindaman reviewer mode is enabled.

Review doctrine:
- Present findings first.
- Prioritize bugs, regressions, security risks, and missing tests.
- Prefer concrete behavioral risks over stylistic commentary.
- If no findings are discovered, say so explicitly.
- After findings, list residual risks or testing gaps briefly.
`.trim()

const IMPLEMENTATION_VERBS = ["implement", "build", "create", "add", "wire", "refactor"]
const ARCHITECTURE_SIGNALS = [
  "api",
  "auth",
  "schema",
  "contract",
  "database",
  "data flow",
  "feature architecture",
  "backend",
  "frontend",
]
const GOVERNANCE_SIGNALS = ["review", "status", "release", "verify", "push", "commit", "doctor"]
const REVIEW_SIGNALS = ["review", "audit", "inspect", "find issues", "risks", "regression"]

const cliPath = () => resolve(process.cwd(), "bin", "rindaman.cjs")

const sessionStates = new Map<string, SessionQualityState>()
const sessionEnabledStates = new Map<string, boolean>()
const sessionModeStates = new Map<string, RindamanMode>()
const sessionSecondaryLayerStates = new Map<string, SecondaryLayer>()
const sessionSeniorEngineerMetadata = new Map<string, SeniorEngineerActivation>()

const getSessionState = (sessionId: string): SessionQualityState => {
  const existing = sessionStates.get(sessionId)
  if (existing) return existing
  const initial = { changedFiles: [] }
  sessionStates.set(sessionId, initial)
  return initial
}

const normalizeCommandText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/^[\s"'`([{]+|[\s"'`)\]}!,.?:;]+$/g, "")

const getToggle = (text: string) => {
  const onCommands = new Set([
    "/rindaman on",
    "rindaman on",
    "/quality on",
    "quality on",
    "/strict on",
    "strict mode",
    "be strict",
  ])
  const offCommands = new Set([
    "/rindaman off",
    "rindaman off",
    "/quality off",
    "quality off",
    "/strict off",
    "normal mode",
    "stop strict",
  ])

  const full = normalizeCommandText(text)
  if (onCommands.has(full)) return true
  if (offCommands.has(full)) return false

  const lines = text.split(/\r?\n/).map(normalizeCommandText).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (onCommands.has(lines[i])) return true
    if (offCommands.has(lines[i])) return false
  }

  return undefined
}

const getModeOverride = (text: string): RindamanMode | undefined => {
  const values: RindamanMode[] = ["core", "senior", "reviewer", "auto"]
  const full = normalizeCommandText(text)
  for (const value of values) {
    if (full === `/rindaman mode ${value}` || full === `rindaman mode ${value}`) return value
  }

  const lines = text.split(/\r?\n/).map(normalizeCommandText).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    for (const value of values) {
      if (lines[i] === `/rindaman mode ${value}` || lines[i] === `rindaman mode ${value}`) {
        return value
      }
    }
  }

  return undefined
}

const collectMatchedSignals = (text: string, signals: string[]) =>
  signals.filter((signal) => text.includes(signal))

const analyzeActivation = (text: string): SeniorEngineerActivation => {
  const normalized = text.toLowerCase()
  const implementationSignals = collectMatchedSignals(normalized, IMPLEMENTATION_VERBS)
  const architectureSignals = collectMatchedSignals(normalized, ARCHITECTURE_SIGNALS)
  const governanceSignals = collectMatchedSignals(normalized, GOVERNANCE_SIGNALS)
  const reviewSignals = collectMatchedSignals(normalized, REVIEW_SIGNALS)

  if (reviewSignals.length > 0) {
    return {
      active: false,
      intent: "review",
      reason: "review-oriented request detected",
      intentSource: "auto-signals",
      matchedSignals: reviewSignals,
    }
  }

  if (governanceSignals.length > 0 && implementationSignals.length === 0) {
    return {
      active: false,
      intent: "review",
      reason: "governance-oriented request detected",
      intentSource: "auto-signals",
      matchedSignals: governanceSignals,
    }
  }

  if (implementationSignals.length > 0 && architectureSignals.length > 0) {
    return {
      active: true,
      intent: "implementation",
      reason: "implementation and product-engineering signals detected",
      intentSource: "auto-signals",
      matchedSignals: [...implementationSignals, ...architectureSignals],
    }
  }

  return {
    active: false,
    intent: "none",
    reason: "no qualifying signals detected",
    intentSource: "none",
    matchedSignals: [],
  }
}

const isVerificationRequired = (state: SessionQualityState) => state.changedFiles.length > 0

const createFinalResponseGate = (state: SessionQualityState, enabled: boolean): FinalResponseGate => {
  if (!enabled) return { allowed: true, reason: "rindaman disabled" }
  if (!isVerificationRequired(state)) return { allowed: true, reason: "verification not required" }
  if (state.lastCheckStatus === "passed") return { allowed: true, reason: "verification passed" }
  if (state.lastCheckStatus === "failed") return { allowed: false, reason: "verification failed" }
  if (state.lastCheckStatus === "error") return { allowed: false, reason: "verification errored" }
  return { allowed: false, reason: "verification pending" }
}

const getCheckFreshness = (state: SessionQualityState): CheckFreshness => {
  if (!state.lastCheckStatus) return "not_run"
  return state.dirtySinceCheck ? "stale" : "fresh"
}

const getNextAction = (
  verificationRequired: boolean,
  checkFreshness: CheckFreshness,
  finalResponse: FinalResponseGate,
) => {
  if (checkFreshness === "not_run") {
    return {
      command: "rindaman_check",
      reason: "verification has not been run for this session",
    }
  }

  if (verificationRequired && checkFreshness === "stale") {
    return {
      command: "rindaman_check",
      reason: "files changed after the last verification",
    }
  }

  if (!finalResponse.allowed) {
    return {
      command: "rindaman_check",
      reason: finalResponse.reason,
    }
  }

  return {
    command: null,
    reason: "no action required",
  }
}

const readChangedFiles = (directory: string) => {
  const gitStatus = spawnSync("git", ["status", "--porcelain"], {
    cwd: directory,
    encoding: "utf8",
  })

  if (gitStatus.status !== 0 || !gitStatus.stdout) return []

  return gitStatus.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
}

const persistState = (pi: ExtensionAPI, sessionId: string) => {
  pi.appendEntry(RINDAMAN_STATE_ENTRY, {
    sessionId,
    quality: sessionStates.get(sessionId),
    enabled: sessionEnabledStates.get(sessionId) ?? true,
    mode: sessionModeStates.get(sessionId),
    secondaryLayer: sessionSecondaryLayerStates.get(sessionId) ?? "none",
    seniorEngineer: sessionSeniorEngineerMetadata.get(sessionId),
  })
}

const restoreState = (ctx: ExtensionContext) => {
  const sessionId = ctx.sessionManager.getSessionFile() ?? "default"
  for (let i = ctx.sessionManager.getBranch().length - 1; i >= 0; i -= 1) {
    const entry = ctx.sessionManager.getBranch()[i]
    if (entry.type !== "custom" || entry.customType !== RINDAMAN_STATE_ENTRY) continue
    const data = entry.data as {
      sessionId?: string
      quality?: SessionQualityState
      enabled?: boolean
      mode?: RindamanMode
      secondaryLayer?: SecondaryLayer
      seniorEngineer?: SeniorEngineerActivation
    }
    if (data.quality) sessionStates.set(sessionId, data.quality)
    sessionEnabledStates.set(sessionId, data.enabled ?? true)
    if (data.mode) sessionModeStates.set(sessionId, data.mode)
    if (data.secondaryLayer) sessionSecondaryLayerStates.set(sessionId, data.secondaryLayer)
    if (data.seniorEngineer) sessionSeniorEngineerMetadata.set(sessionId, data.seniorEngineer)
    return
  }
  getSessionState(sessionId)
  sessionEnabledStates.set(sessionId, true)
}

const getSessionId = (ctx: ExtensionContext) => ctx.sessionManager.getSessionFile() ?? "default"

export default function rindaman(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx)
  })

  pi.on("input", async (event, ctx) => {
    const text = event.text ?? ""
    const sessionId = getSessionId(ctx)
    const toggle = getToggle(text)
    const mode = getModeOverride(text)

    if (typeof toggle === "boolean") {
      sessionEnabledStates.set(sessionId, toggle)
      persistState(pi, sessionId)
      if (ctx.hasUI) ctx.ui.notify(`Rindaman ${toggle ? "enabled" : "disabled"}.`, "info")
      return { action: "handled" }
    }

    if (mode) {
      sessionModeStates.set(sessionId, mode)
      persistState(pi, sessionId)
      if (ctx.hasUI) ctx.ui.notify(`Rindaman mode: ${mode}.`, "info")
      return { action: "handled" }
    }

    return { action: "continue" }
  })

  pi.on("before_agent_start", async (event, ctx) => {
    const sessionId = getSessionId(ctx)
    const enabled = sessionEnabledStates.get(sessionId) ?? true
    const mode = sessionModeStates.get(sessionId) ?? "auto"
    const activation = analyzeActivation(event.prompt)

    const secondaryLayer: SecondaryLayer = !enabled
      ? "none"
      : mode === "senior"
        ? "senior"
        : mode === "reviewer"
          ? "reviewer"
          : mode === "core"
            ? "none"
            : activation.intent === "review"
              ? "reviewer"
              : activation.active
                ? "senior"
                : "none"

    sessionSecondaryLayerStates.set(sessionId, secondaryLayer)
    sessionSeniorEngineerMetadata.set(sessionId, {
      ...activation,
      active: secondaryLayer !== "none",
      intentSource: mode === "auto" ? activation.intentSource : "forced-mode",
      reason:
        mode === "senior"
          ? "senior mode forced"
          : mode === "reviewer"
            ? "reviewer mode forced"
            : mode === "core"
              ? "core mode forced"
              : activation.reason,
    })
    persistState(pi, sessionId)

    if (!enabled) return

    let systemPrompt = `${event.systemPrompt}\n\n${RINDAMAN_RULE}`
    if (secondaryLayer === "senior") systemPrompt += `\n\n${RINDAMAN_SENIOR_RULE}`
    if (secondaryLayer === "reviewer") systemPrompt += `\n\n${RINDAMAN_REVIEWER_RULE}`

    return { systemPrompt }
  })

  pi.on("tool_call", async (event, ctx) => {
    const sessionId = getSessionId(ctx)
    const state = getSessionState(sessionId)

    if (event.toolName === "write" || event.toolName === "edit") {
      const path = typeof event.input.path === "string" ? event.input.path : undefined
      if (path && !state.changedFiles.includes(path)) state.changedFiles.push(path)
      state.dirtySinceCheck = true
    }

    if (event.toolName === "bash") {
      const command = typeof event.input.command === "string" ? event.input.command : ""
      if (/\bgit\s+(commit|push)\b/.test(command) || /\bgh\s+pr\s+create\b/.test(command)) {
        const enabled = sessionEnabledStates.get(sessionId) ?? true
        const finalResponse = createFinalResponseGate(state, enabled)
        if (!finalResponse.allowed) {
          return {
            block: true,
            reason: `Rindaman: ${finalResponse.reason}. Run rindaman_check first.`,
          }
        }
      }
    }

    persistState(pi, sessionId)
    return undefined
  })

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined
    const sessionId = getSessionId(ctx)
    const state = getSessionState(sessionId)
    const changedFiles = readChangedFiles(ctx.cwd)
    if (changedFiles.length > 0) state.changedFiles = changedFiles
    persistState(pi, sessionId)
    return undefined
  })

  pi.registerCommand("rindaman", {
    description: "Toggle Rindaman or change mode: on|off|mode <core|senior|reviewer|auto>",
    handler: async (args, ctx) => {
      const sessionId = getSessionId(ctx)
      const trimmed = args.trim().toLowerCase()

      if (trimmed === "on") {
        sessionEnabledStates.set(sessionId, true)
        persistState(pi, sessionId)
        ctx.ui.notify("Rindaman enabled.", "info")
        return
      }
      if (trimmed === "off") {
        sessionEnabledStates.set(sessionId, false)
        persistState(pi, sessionId)
        ctx.ui.notify("Rindaman disabled.", "info")
        return
      }
      if (trimmed.startsWith("mode ")) {
        const mode = trimmed.slice(5) as RindamanMode
        if (["core", "senior", "reviewer", "auto"].includes(mode)) {
          sessionModeStates.set(sessionId, mode)
          persistState(pi, sessionId)
          ctx.ui.notify(`Rindaman mode: ${mode}.`, "info")
          return
        }
      }

      ctx.ui.notify("Usage: /rindaman on|off|mode <core|senior|reviewer|auto>", "error")
    },
  })

  pi.registerCommand("quality", {
    description: "Alias for /rindaman on|off",
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase()
      const sessionId = getSessionId(ctx)
      if (value === "on" || value === "off") {
        sessionEnabledStates.set(sessionId, value === "on")
        persistState(pi, sessionId)
        ctx.ui.notify(`Rindaman ${value === "on" ? "enabled" : "disabled"}.`, "info")
        return
      }
      ctx.ui.notify("Usage: /quality on|off", "error")
    },
  })

  pi.registerCommand("strict", {
    description: "Alias for /rindaman on|off",
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase()
      const sessionId = getSessionId(ctx)
      if (value === "on" || value === "off") {
        sessionEnabledStates.set(sessionId, value === "on")
        persistState(pi, sessionId)
        ctx.ui.notify(`Strict mode ${value === "on" ? "enabled" : "disabled"}.`, "info")
        return
      }
      ctx.ui.notify("Usage: /strict on|off", "error")
    },
  })

  pi.registerTool({
    name: "rindaman_check",
    label: "Rindaman Check",
    description: "Run Rindaman quality verification from the current project directory and record session check status.",
    parameters: Type.Object({
      mode: Type.Optional(Type.Union([
        Type.Literal("check"),
        Type.Literal("audit"),
        Type.Literal("doctor"),
      ], { default: "check" })),
      json: Type.Optional(Type.Boolean({ default: false })),
      strict: Type.Optional(Type.Boolean({ default: false })),
      report: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sessionId = getSessionId(ctx)
      const state = getSessionState(sessionId)
      const mode = params.mode ?? "check"
      const commandArgs = [cliPath()]

      if (mode !== "check") commandArgs.push(mode)
      if (params.json) commandArgs.push("--json")
      if (params.strict) commandArgs.push("--strict")
      if (params.report) commandArgs.push("--report")

      const result = spawnSync("node", commandArgs, {
        cwd: ctx.cwd,
        encoding: "utf8",
      })

      const changedFiles = readChangedFiles(ctx.cwd)
      if (changedFiles.length > 0) state.changedFiles = changedFiles
      state.lastCheckAt = new Date().toISOString()
      state.lastCheckCommand = ["node", ...commandArgs].join(" ")
      state.lastCheckExitCode = result.status
      state.dirtySinceCheck = false
      state.lastCheckStatus = result.error ? "error" : result.status === 0 ? "passed" : "failed"
      persistState(pi, sessionId)

      const finalResponse = createFinalResponseGate(state, sessionEnabledStates.get(sessionId) ?? true)
      const checkFreshness = getCheckFreshness(state)
      const nextAction = getNextAction(isVerificationRequired(state), checkFreshness, finalResponse)

      return {
        content: [
          {
            type: "text",
            text: [
              result.stdout,
              result.stderr,
              "",
              `Rindaman status: ${state.lastCheckStatus}`,
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
      }
    },
  })

  pi.registerTool({
    name: "rindaman_status",
    label: "Rindaman Status",
    description: "Report Rindaman session state, changed files, and the last quality check result.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sessionId = getSessionId(ctx)
      const state = getSessionState(sessionId)
      const changedFiles = readChangedFiles(ctx.cwd)
      if (changedFiles.length > 0) state.changedFiles = changedFiles

      const enabled = sessionEnabledStates.get(sessionId) ?? true
      const checkFreshness = getCheckFreshness(state)
      const finalResponse = createFinalResponseGate(state, enabled)
      const nextAction = getNextAction(isVerificationRequired(state), checkFreshness, finalResponse)
      const mode = sessionModeStates.get(sessionId) ?? "auto"
      const secondaryLayer = sessionSecondaryLayerStates.get(sessionId) ?? "none"
      const seniorEngineer = sessionSeniorEngineerMetadata.get(sessionId) ?? {
        active: false,
        intent: "none",
        reason: "no activation analysis recorded",
        intentSource: "none",
        matchedSignals: [],
      }

      persistState(pi, sessionId)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                enabled,
                strictResponses: enabled,
                qualityLifecycle: true,
                mode,
                secondaryLayer,
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
                seniorEngineer: {
                  active: seniorEngineer.active,
                  effectiveMode: mode,
                  reason: seniorEngineer.reason,
                  intent: seniorEngineer.intent,
                  intentSource: seniorEngineer.intentSource,
                  matchedSignals: seniorEngineer.matchedSignals,
                },
                reviewer: {
                  active: secondaryLayer === "reviewer",
                  reason: secondaryLayer === "reviewer" ? seniorEngineer.reason : "reviewer layer inactive",
                  intent: secondaryLayer === "reviewer" ? seniorEngineer.intent : "none",
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
          mode,
          secondaryLayer,
        },
      }
    },
  })
}
