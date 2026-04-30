import { spawnSync } from "node:child_process";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

import { RINDAMAN_STATE_ENTRY } from "./constants.ts";
import type { SessionQualityState } from "./types.ts";

const sessionStates = new Map<string, SessionQualityState>();
const sessionEnabledStates = new Map<string, boolean>();

export const getSessionId = (ctx: ExtensionContext) =>
  ctx.sessionManager.getSessionFile() ?? "default";

export const getSessionState = (sessionId: string): SessionQualityState => {
  const existing = sessionStates.get(sessionId);
  if (existing) return existing;
  const initial = { changedFiles: [] };
  sessionStates.set(sessionId, initial);
  return initial;
};

export const getSessionEnabled = (sessionId: string) => sessionEnabledStates.get(sessionId) ?? true;

export const setSessionEnabled = (sessionId: string, enabled: boolean) => {
  sessionEnabledStates.set(sessionId, enabled);
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

export const addChangedFile = (state: SessionQualityState, filePath?: string) => {
  if (!filePath || state.changedFiles.includes(filePath)) return;
  state.changedFiles = [...state.changedFiles, filePath];
  state.dirtySinceCheck = true;
};

export const updateChangedFiles = (state: SessionQualityState, cwd: string) => {
  const changedFiles = readChangedFiles(cwd);
  if (changedFiles.length > 0) state.changedFiles = changedFiles;
};

export const persistState = (pi: ExtensionAPI, sessionId: string) => {
  pi.appendEntry(RINDAMAN_STATE_ENTRY, {
    sessionId,
    quality: sessionStates.get(sessionId),
    enabled: getSessionEnabled(sessionId),
  });
};

export const restoreState = (ctx: ExtensionContext) => {
  const sessionId = getSessionId(ctx);
  const branch = ctx.sessionManager.getBranch();

  for (let i = branch.length - 1; i >= 0; i -= 1) {
    const entry = branch[i];
    if (entry.type !== "custom" || entry.customType !== RINDAMAN_STATE_ENTRY) continue;
    const data = entry.data as {
      sessionId?: string;
      quality?: SessionQualityState;
      enabled?: boolean;
    };
    if (data.quality) sessionStates.set(sessionId, data.quality);
    setSessionEnabled(sessionId, data.enabled ?? true);
    return;
  }

  getSessionState(sessionId);
  setSessionEnabled(sessionId, true);
};
