import {
  createFinalResponseGate,
  getCheckFreshness,
  getNextAction,
  isVerificationRequired,
} from "./gating.ts";
import type { SessionQualityState } from "./types.ts";

export const createStatusPayload = (state: SessionQualityState, enabled: boolean) => {
  const checkFreshness = getCheckFreshness(state);
  const finalResponse = createFinalResponseGate(state, enabled);
  const nextAction = getNextAction(isVerificationRequired(state), checkFreshness, finalResponse);

  return {
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
  };
};

export const createCheckSummaryText = (
  stdout: string,
  stderr: string,
  state: SessionQualityState,
  enabled: boolean,
) => {
  const status = createStatusPayload(state, enabled);

  return [
    stdout,
    stderr,
    "",
    `pi-rindaman status: ${state.lastCheckStatus}`,
    `Exit code: ${String(state.lastCheckExitCode)}`,
    `Final response allowed: ${String(status.finalResponse.allowed)}`,
    `Final response reason: ${status.finalResponse.reason}`,
    `Check freshness: ${status.checkFreshness}`,
    `Next action: ${status.nextAction.command ?? "none"}`,
    `Next action reason: ${status.nextAction.reason}`,
  ]
    .filter(Boolean)
    .join("\n");
};
