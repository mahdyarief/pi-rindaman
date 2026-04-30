export type CheckFreshness = "not_run" | "fresh" | "stale";

export type SessionQualityState = {
  changedFiles: string[];
  lastCheckAt?: string;
  lastCheckStatus?: "passed" | "failed" | "error";
  lastCheckCommand?: string;
  lastCheckExitCode?: number | null;
  dirtySinceCheck?: boolean;
};

export type FinalResponseGate = {
  allowed: boolean;
  reason: string;
};

export type CheckToolParams = {
  mode?: "check" | "audit" | "doctor";
  json?: boolean;
  strict?: boolean;
  report?: boolean;
};
