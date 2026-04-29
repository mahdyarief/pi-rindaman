const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function getWindowsCommandName(commandName) {
  if (process.platform !== "win32") {
    return commandName;
  }

  if (["npm", "pnpm", "yarn", "bun"].includes(commandName)) {
    return `${commandName}.cmd`;
  }

  return commandName;
}

function quoteWindowsArgument(argument) {
  if (/^[A-Za-z0-9_./:=+\\-]+$/.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/g, '""')}"`;
}

function createSpawnSpec(commandName, args) {
  const finalCommandName = getWindowsCommandName(commandName);

  if (process.platform === "win32" && finalCommandName.endsWith(".cmd")) {
    const comspec = process.env.ComSpec ?? "cmd.exe";
    const windowsCommand = [
      quoteWindowsArgument(finalCommandName),
      ...args.map(quoteWindowsArgument),
    ].join(" ");

    return {
      file: comspec,
      args: ["/d", "/s", "/c", windowsCommand],
      displayCommand: [commandName, ...args].join(" "),
    };
  }

  return {
    file: finalCommandName,
    args,
    displayCommand: [commandName, ...args].join(" "),
  };
}

function executeCommand(commandName, args, options = {}) {
  const startTime = Date.now();
  const spawnSpec = createSpawnSpec(commandName, args);
  const result = spawnSync(spawnSpec.file, spawnSpec.args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });

  return {
    result,
    durationMs: Date.now() - startTime,
    command: spawnSpec.displayCommand,
  };
}

function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) {
    return "bun";
  }

  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) {
    return "yarn";
  }

  return "npm";
}

function getLocalBinaryPath(projectRoot, binaryName) {
  const extension = process.platform === "win32" ? ".cmd" : "";
  return path.join(projectRoot, "node_modules", ".bin", `${binaryName}${extension}`);
}

function executeLocalBinary(projectRoot, binaryName, args, inherit) {
  const binaryPath = getLocalBinaryPath(projectRoot, binaryName);

  if (!fs.existsSync(binaryPath)) {
    return {
      status: "skipped",
      severity: "warning",
      command: [binaryName, ...args].join(" "),
      reason: `${binaryName} is not installed locally`,
      exitCode: null,
      durationMs: 0,
    };
  }

  const executedCommand = executeCommand(binaryPath, args, {
    cwd: projectRoot,
    inherit,
  });

  return {
    status: executedCommand.result.status === 0 ? "passed" : "failed",
    severity: "blocker",
    command: executedCommand.command,
    reason: null,
    exitCode: executedCommand.result.status,
    durationMs: executedCommand.durationMs,
    stdout: executedCommand.result.stdout ?? "",
    stderr: executedCommand.result.stderr ?? "",
  };
}

function getPackageScriptCommand(packageManager, scriptName) {
  if (packageManager === "npm") {
    return {
      commandName: "npm",
      args: ["run", scriptName],
    };
  }

  return {
    commandName: packageManager,
    args: [scriptName],
  };
}

function executePackageScript(projectRoot, packageManager, scriptName, inherit, readJsonFile) {
  const packageJson = readJsonFile(path.join(projectRoot, "package.json"));

  if (!packageJson) {
    return {
      status: "skipped",
      severity: "warning",
      command: scriptName,
      reason: "package.json not found",
      exitCode: null,
      durationMs: 0,
    };
  }

  if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
    return {
      status: "skipped",
      severity: "warning",
      command: scriptName,
      reason: `script "${scriptName}" not found`,
      exitCode: null,
      durationMs: 0,
    };
  }

  const scriptCommand = getPackageScriptCommand(packageManager, scriptName);
  const executedCommand = executeCommand(scriptCommand.commandName, scriptCommand.args, {
    cwd: projectRoot,
    inherit,
  });

  return {
    status: executedCommand.result.status === 0 ? "passed" : "failed",
    severity: "blocker",
    command: executedCommand.command,
    reason: null,
    exitCode: executedCommand.result.status,
    durationMs: executedCommand.durationMs,
    stdout: executedCommand.result.stdout ?? "",
    stderr: executedCommand.result.stderr ?? "",
  };
}

function readGitOutput(projectRoot, gitArgs) {
  const executedCommand = executeCommand("git", gitArgs, {
    cwd: projectRoot,
  });

  if (executedCommand.result.status !== 0) {
    return "";
  }

  return (executedCommand.result.stdout ?? "").trim();
}

function detectBaseRef(projectRoot, config) {
  if (config.baseRef) {
    return config.baseRef;
  }

  const candidateRefs = ["upstream/main", "origin/main", "main", "master", "HEAD"];

  for (const candidateRef of candidateRefs) {
    if (readGitOutput(projectRoot, ["rev-parse", "--verify", candidateRef])) {
      return candidateRef;
    }
  }

  return "HEAD";
}

function getChangedFiles(projectRoot, baseRef) {
  const diffOutput = readGitOutput(projectRoot, [
    "diff",
    baseRef,
    "--name-only",
    "--diff-filter=ACMR",
  ]);
  const statusOutput = readGitOutput(projectRoot, ["status", "--porcelain"]);

  const diffFiles = diffOutput ? diffOutput.split(/\r?\n/) : [];
  const statusFiles = statusOutput
    ? statusOutput
        .split(/\r?\n/)
        .map((line) => line.slice(3).trim())
        .filter(Boolean)
    : [];

  return [...new Set([...diffFiles, ...statusFiles])].filter((changedFile) =>
    fs.existsSync(path.join(projectRoot, changedFile)),
  );
}

function getExplicitTargetFiles(projectRoot, commandArgs) {
  const flagsWithValues = new Set([
    "--base",
    "--report-path",
    "--debt-mode",
    "--baseline-path",
    "--workspace",
  ]);
  const explicitTargetFiles = [];

  for (let argumentIndex = 0; argumentIndex < commandArgs.length; argumentIndex += 1) {
    const commandArgument = commandArgs[argumentIndex];

    if (flagsWithValues.has(commandArgument)) {
      argumentIndex += 1;
      continue;
    }

    if (commandArgument.startsWith("--")) {
      continue;
    }

    if (fs.existsSync(path.join(projectRoot, commandArgument))) {
      explicitTargetFiles.push(commandArgument);
    }
  }

  return explicitTargetFiles;
}

function isJavaScriptOrTypeScriptFile(filePath) {
  return /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(filePath);
}

function matchesIgnorePattern(filePath, pattern, normalizePathForMatch) {
  const normalizedFilePath = normalizePathForMatch(filePath);
  const normalizedPattern = normalizePathForMatch(pattern);

  if (normalizedPattern.endsWith("/**")) {
    return normalizedFilePath.startsWith(normalizedPattern.slice(0, -3));
  }

  if (normalizedPattern.startsWith("**/")) {
    return normalizedFilePath.endsWith(normalizedPattern.slice(3));
  }

  return (
    normalizedFilePath === normalizedPattern ||
    normalizedFilePath.startsWith(`${normalizedPattern}/`)
  );
}

function filterIgnoredFiles(files, ignorePatterns, normalizePathForMatch) {
  return files.filter(
    (file) =>
      !ignorePatterns.some((ignorePattern) =>
        matchesIgnorePattern(file, ignorePattern, normalizePathForMatch),
      ),
  );
}

function getFormatterConfigPresence(projectRoot, readJsonFile) {
  const hasBiome =
    fs.existsSync(path.join(projectRoot, "biome.json")) ||
    fs.existsSync(path.join(projectRoot, "biome.jsonc"));

  const prettierConfigFiles = [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.mjs",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
  ];
  const packageJson = readJsonFile(path.join(projectRoot, "package.json"));
  const hasPrettier =
    prettierConfigFiles.some((configFile) => fs.existsSync(path.join(projectRoot, configFile))) ||
    Boolean(packageJson?.prettier);

  return {
    biome: hasBiome,
    prettier: hasPrettier,
  };
}

function detectFormatter(projectRoot, readJsonFile) {
  const configPresence = getFormatterConfigPresence(projectRoot, readJsonFile);

  if (configPresence.biome) {
    return "biome";
  }

  if (configPresence.prettier) {
    return "prettier";
  }

  return undefined;
}

function getQualityConfigFiles(projectRoot, readJsonFile) {
  const formatterConfigPresence = getFormatterConfigPresence(projectRoot, readJsonFile);

  return {
    biome: formatterConfigPresence.biome,
    prettier: formatterConfigPresence.prettier,
    knip: fs.existsSync(path.join(projectRoot, "knip.json")),
  };
}

function createSkippedCheck(name, reason, severity = "warning") {
  return {
    name,
    status: "skipped",
    severity,
    command: null,
    reason,
    exitCode: null,
    durationMs: 0,
  };
}

function createCheckResult(name, checkResult, flags) {
  return {
    name,
    status: checkResult.status,
    severity: checkResult.severity,
    command: checkResult.command ?? null,
    reason: checkResult.reason ?? null,
    exitCode: typeof checkResult.exitCode === "number" ? checkResult.exitCode : null,
    durationMs: checkResult.durationMs ?? 0,
    stdout: flags.has("--include-output") ? (checkResult.stdout ?? "") : undefined,
    stderr: flags.has("--include-output") ? (checkResult.stderr ?? "") : undefined,
    summary: checkResult.summary ?? undefined,
  };
}

function hasSupportedAuditLockfile(projectRoot) {
  return fs.existsSync(path.join(projectRoot, "package-lock.json"));
}

function readAuditSummary(auditOutput) {
  const parsedAudit = JSON.parse(auditOutput);
  const vulnerabilities = parsedAudit?.metadata?.vulnerabilities ?? {};

  return {
    moderate: Number(vulnerabilities.moderate ?? 0),
    high: Number(vulnerabilities.high ?? 0),
    critical: Number(vulnerabilities.critical ?? 0),
  };
}

function runSecurityCheck(projectRoot, inherit) {
  if (!hasSupportedAuditLockfile(projectRoot)) {
    return {
      status: "skipped",
      severity: "warning",
      command: "npm audit --json",
      reason: "lockfile not found",
      exitCode: null,
      durationMs: 0,
      summary: {
        moderate: 0,
        high: 0,
        critical: 0,
      },
    };
  }

  const executedCommand = executeCommand("npm", ["audit", "--json"], {
    cwd: projectRoot,
    inherit,
  });

  try {
    const summary = readAuditSummary(executedCommand.result.stdout ?? "{}");
    return {
      status: "passed",
      severity: "blocker",
      command: executedCommand.command,
      reason: null,
      exitCode: executedCommand.result.status,
      durationMs: executedCommand.durationMs,
      stdout: executedCommand.result.stdout ?? "",
      stderr: executedCommand.result.stderr ?? "",
      summary,
    };
  } catch (_error) {
    return {
      status: "failed",
      severity: "blocker",
      command: executedCommand.command,
      reason: "invalid audit output",
      exitCode: executedCommand.result.status,
      durationMs: executedCommand.durationMs,
      stdout: executedCommand.result.stdout ?? "",
      stderr: executedCommand.result.stderr ?? "",
      summary: {
        moderate: 0,
        high: 0,
        critical: 0,
      },
    };
  }
}

function runSemanticCheck(projectRoot, targetFiles, config, inherit) {
  const enginePath = path.resolve(__dirname, "..", "quality-engine", "engine.cjs");

  if (!fs.existsSync(enginePath)) {
    return {
      status: "failed",
      severity: "blocker",
      command: `node ${enginePath}`,
      reason: "quality engine not found",
      exitCode: 2,
      durationMs: 0,
    };
  }

  const executedCommand = executeCommand("node", [enginePath, ...targetFiles], {
    cwd: projectRoot,
    inherit,
    env: {
      PI_RINDAMAN_WRITE_REPORT: config.writeReport ? "1" : "0",
      PI_RINDAMAN_REPORT_PATH: config.reportPath,
    },
  });

  return {
    status: executedCommand.result.status === 0 ? "passed" : "failed",
    severity: "blocker",
    command: executedCommand.command,
    reason: null,
    exitCode: executedCommand.result.status,
    durationMs: executedCommand.durationMs,
    stdout: executedCommand.result.stdout ?? "",
    stderr: executedCommand.result.stderr ?? "",
  };
}

function runTypeCheck(projectRoot, packageManager, inherit, readJsonFile) {
  return executePackageScript(projectRoot, packageManager, "typecheck", inherit, readJsonFile);
}

function runSyntaxCheck(projectRoot, formatter, targetFiles, changedOnly, inherit) {
  if (!formatter) {
    return createSkippedCheck(
      "syntax",
      "Formatter config not found. Add biome.json, biome.jsonc, Prettier config, or package.json#prettier.",
    );
  }

  if (formatter === "biome") {
    return executeLocalBinary(
      projectRoot,
      "biome",
      ["check", ...(changedOnly ? targetFiles : ["."])],
      inherit,
    );
  }

  return executeLocalBinary(
    projectRoot,
    "prettier",
    ["--check", ...(changedOnly ? targetFiles : ["."])],
    inherit,
  );
}

function runHygieneCheck(projectRoot, inherit) {
  if (!fs.existsSync(path.join(projectRoot, "knip.json"))) {
    return createSkippedCheck(
      "hygiene",
      "knip config not found. Add knip.json to enable unused-code detection.",
    );
  }

  return executeLocalBinary(projectRoot, "knip", [], inherit);
}

function createCheckCommandResult(
  auditMode,
  projectRoot,
  config,
  workspace,
  cliArgs,
  readBaselineFile,
  createDebtResult,
  getOverallStatus,
  normalizePathForMatch,
  readJsonFile,
) {
  const executionRoot = workspace?.root ?? projectRoot;
  const packageManager = detectPackageManager(executionRoot);
  const baseRef = detectBaseRef(executionRoot, config);
  const explicitTargetFiles = getExplicitTargetFiles(executionRoot, cliArgs.commandArgs);
  const allChangedFiles = config.changedOnly
    ? explicitTargetFiles.length > 0
      ? explicitTargetFiles
      : getChangedFiles(executionRoot, baseRef)
    : [];
  const changedFiles = filterIgnoredFiles(
    allChangedFiles,
    config.ignorePatterns,
    normalizePathForMatch,
  );
  const targetFiles = config.changedOnly ? changedFiles.filter(isJavaScriptOrTypeScriptFile) : [];
  const inheritOutput = !cliArgs.jsonOutput;
  const formatter =
    detectFormatter(executionRoot, readJsonFile) ?? detectFormatter(projectRoot, readJsonFile);

  const checks = [];

  if (config.checks.semantic) {
    checks.push(
      createCheckResult(
        "semantic",
        runSemanticCheck(executionRoot, targetFiles, config, inheritOutput),
        cliArgs.flags,
      ),
    );
  } else {
    checks.push(createSkippedCheck("semantic", "Disabled by config", "info"));
  }

  if (config.checks.types) {
    checks.push(
      createCheckResult(
        "types",
        runTypeCheck(executionRoot, packageManager, inheritOutput, readJsonFile),
        cliArgs.flags,
      ),
    );
  } else {
    checks.push(createSkippedCheck("types", "Disabled by config", "info"));
  }

  if (config.checks.syntax) {
    checks.push(
      createCheckResult(
        "syntax",
        runSyntaxCheck(executionRoot, formatter, targetFiles, config.changedOnly, inheritOutput),
        cliArgs.flags,
      ),
    );
  } else {
    checks.push(createSkippedCheck("syntax", "Disabled by config", "info"));
  }

  if (config.checks.hygiene) {
    checks.push(
      createCheckResult("hygiene", runHygieneCheck(executionRoot, inheritOutput), cliArgs.flags),
    );
  } else {
    checks.push(createSkippedCheck("hygiene", "Disabled by config", "info"));
  }

  if (config.checks.security) {
    checks.push(
      createCheckResult("security", runSecurityCheck(executionRoot, inheritOutput), cliArgs.flags),
    );
  } else {
    checks.push(createSkippedCheck("security", "Disabled by config", "info"));
  }

  const baseline = readBaselineFile(executionRoot, config);
  const debt = createDebtResult(config, config.changedOnly, targetFiles, checks, baseline);
  const status = getOverallStatus(checks, config, debt);

  return {
    command: auditMode ? "audit" : "check",
    status: auditMode && status === "failed" ? "audit_failed" : status,
    projectRoot,
    workspace: workspace ?? null,
    packageManager,
    baseRef,
    changedOnly: config.changedOnly,
    changedFiles,
    targetFiles,
    formatter: formatter ?? null,
    reportPath: config.writeReport ? path.resolve(executionRoot, config.reportPath) : null,
    checks,
    baseline,
    debt,
    policy: {
      strictWarnings: config.strictWarnings,
      allowPackageInstall: config.allowPackageInstall,
      writeReport: config.writeReport,
      debtMode: config.debtMode,
      failOnExistingDebt: config.failOnExistingDebt,
      baselinePath: config.baselinePath,
      useBaseline: config.useBaseline,
      ignorePatterns: config.ignorePatterns,
    },
  };
}

function createWorkspaceAggregateResult(
  auditMode,
  projectRoot,
  cliArgs,
  discoverWorkspaces,
  readWorkspaceConfig,
  applyFlagOverrides,
  readFlagValue,
  readDebtModeFlag,
  readBaselineFile,
  createDebtResult,
  getOverallStatus,
  getWorkspaceAggregateStatus,
  normalizePathForMatch,
  readJsonFile,
) {
  const workspaces = discoverWorkspaces(projectRoot, readJsonFile);

  if (workspaces.length === 0) {
    throw new Error("No workspaces found");
  }

  const workspaceResults = workspaces.map((workspace) => {
    const workspaceConfig = applyFlagOverrides(
      readWorkspaceConfig(projectRoot, workspace.root),
      cliArgs,
      readFlagValue,
      readDebtModeFlag,
    );
    return createCheckCommandResult(
      auditMode,
      projectRoot,
      workspaceConfig,
      workspace,
      cliArgs,
      readBaselineFile,
      createDebtResult,
      getOverallStatus,
      normalizePathForMatch,
      readJsonFile,
    );
  });
  const status = getWorkspaceAggregateStatus(workspaceResults);

  return {
    command: auditMode ? "audit" : "check",
    status: auditMode && status === "failed" ? "audit_failed" : status,
    projectRoot,
    workspaces: workspaceResults,
  };
}

module.exports = {
  detectPackageManager,
  detectFormatter,
  executePackageScript,
  getLocalBinaryPath,
  getQualityConfigFiles,
  runSecurityCheck,
  createCheckCommandResult,
  createWorkspaceAggregateResult,
};
