import { spawnSync } from "node:child_process";

import { getCliPath } from "./constants.ts";
import type { CheckToolParams } from "./types.ts";

const buildCheckCommandArgs = (params: CheckToolParams) => {
  const mode = params.mode ?? "check";
  const commandArgs = [getCliPath()];

  if (mode !== "check") commandArgs.push(mode);
  if (params.json) commandArgs.push("--json");
  if (params.strict) commandArgs.push("--strict");
  if (params.report) commandArgs.push("--report");

  return commandArgs;
};

export const runCheckTool = (cwd: string, params: CheckToolParams) => {
  const commandArgs = buildCheckCommandArgs(params);
  const result = spawnSync("node", commandArgs, {
    cwd,
    encoding: "utf8",
  });

  return { commandArgs, result };
};
