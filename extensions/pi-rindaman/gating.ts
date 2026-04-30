import type { CheckFreshness, FinalResponseGate, SessionQualityState } from "./types.ts";

export const isVerificationRequired = (state: SessionQualityState) => state.changedFiles.length > 0;

export const createFinalResponseGate = (
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

export const getCheckFreshness = (state: SessionQualityState): CheckFreshness => {
  if (!state.lastCheckStatus) return "not_run";
  return state.dirtySinceCheck ? "stale" : "fresh";
};

export const getNextAction = (
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
