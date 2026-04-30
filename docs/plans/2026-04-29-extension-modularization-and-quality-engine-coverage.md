# Extension Modularization and Quality-Engine Coverage Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Refactor `extensions/pi-rindaman.ts` into small verification-focused modules and add direct automated coverage proving `src/quality-engine` is wired, packaged, and working.

**Architecture:** Keep the public package contract unchanged while extracting pure helpers and focused registration code from `extensions/pi-rindaman.ts` into module files under `extensions/pi-rindaman/`. Drive the refactor with tests first, then add quality-engine integration tests that assert the semantic engine is executed by the CLI and produces expected reportable signals.

**Tech Stack:** TypeScript runtime-loaded Pi extension, CommonJS CLI and quality engine, Node test runner, `spawnSync`, npm scripts.

---

### Task 1: Lock the current extension contract before refactoring

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `test/extension.test.mjs`
- Test: `test/extension.test.mjs`

**Step 1: Write the failing test**

Add tests in `test/extension.test.mjs` that pin the current extension contract more precisely:
- `pi_rindaman_check` returns `details.status`, `details.command`, `details.checkedAt`, `details.exitCode`
- `pi_rindaman_status` returns `nextAction.command`, `nextAction.reason`, and `finalResponse.allowed`
- toggling `/strict off` changes `status.enabled` and `status.strictResponses` to `false`
- invalid `/strict maybe` produces `Usage: /strict on|off`

Add the new test bodies near the existing three tests, using unique session ids.

**Step 2: Run test to verify it fails**

Run: `node --test test/extension.test.mjs`
Expected: FAIL because the new assertions expose behavior not yet fully pinned in the harness or need setup helpers.

**Step 3: Write minimal implementation**

Adjust only the test harness setup in `test/extension.test.mjs` as needed to exercise the existing extension behavior without changing product code yet.

**Step 4: Run test to verify it passes**

Run: `node --test test/extension.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add test/extension.test.mjs
git commit -m "test: lock extension verification contract"
```

### Task 2: Extract extension types and constants

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Create: `extensions/pi-rindaman/types.ts`
- Create: `extensions/pi-rindaman/constants.ts`
- Modify: `extensions/pi-rindaman.ts:8-64`
- Test: `test/extension.test.mjs`

**Step 1: Write the failing test**

No new behavioral test is required. Use the existing locked tests as the safety net.

**Step 2: Run test to verify current baseline**

Run: `node --test test/extension.test.mjs`
Expected: PASS before refactor

**Step 3: Write minimal implementation**

Create `extensions/pi-rindaman/types.ts`:

```ts
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
```

Create `extensions/pi-rindaman/constants.ts`:

```ts
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RINDAMAN_STATE_ENTRY = "pi_rindaman_state";

export const RINDAMAN_RULE = `...existing rule text...`.trim();

const extensionDirectory = fileURLToPath(new URL(".", import.meta.url));

export const getCliPath = () => resolve(extensionDirectory, "..", "bin", "pi-rindaman.cjs");
```

Update `extensions/pi-rindaman.ts` to import from these modules and remove duplicated local declarations.

**Step 4: Run test to verify it passes**

Run: `node --test test/extension.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add extensions/pi-rindaman.ts extensions/pi-rindaman/types.ts extensions/pi-rindaman/constants.ts
git commit -m "refactor: extract pi-rindaman extension constants"
```

### Task 3: Extract command parsing helpers

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Create: `extensions/pi-rindaman/command-parsing.ts`
- Modify: `extensions/pi-rindaman.ts:77-130,304-336`
- Test: `test/extension.test.mjs`

**Step 1: Write the failing test**

Add focused tests in `test/extension.test.mjs` for command parsing behavior by driving registered commands:
- `/pi-rindaman on` enables
- `/pi-rindaman off` disables
- `/pi-rindaman mode reviewer` stays invalid
- `/strict on` enables
- `/strict off` disables

Keep expected notifications explicit.

**Step 2: Run test to verify it fails**

Run: `node --test test/extension.test.mjs`
Expected: FAIL after adding stricter parsing assertions

**Step 3: Write minimal implementation**

Create `extensions/pi-rindaman/command-parsing.ts`:

```ts
const normalizeCommandText = (text: string) =>
  text.trim().toLowerCase().replace(/^[\s"'`([{]+|[\s"'`)\]}!,.?:;]+$/g, "");

const getNormalizedLines = (text: string) =>
  text.split(/\r?\n/).map(normalizeCommandText).filter(Boolean);

export const stripCommandPrefix = (text: string, commandName: string) => { /* move existing logic */ };
export const getToggle = (text: string) => { /* move existing logic */ };
```

Update `extensions/pi-rindaman.ts` to import these helpers.

**Step 4: Run test to verify it passes**

Run: `node --test test/extension.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add extensions/pi-rindaman.ts extensions/pi-rindaman/command-parsing.ts test/extension.test.mjs
git commit -m "refactor: extract pi-rindaman command parsing"
```

### Task 4: Extract session state and gate logic

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Create: `extensions/pi-rindaman/state.ts`
- Create: `extensions/pi-rindaman/gating.ts`
- Modify: `extensions/pi-rindaman.ts:66-75,132-228,267-299,420-455`
- Test: `test/extension.test.mjs`

**Step 1: Write the failing test**

Add tests in `test/extension.test.mjs` that prove:
- when the extension sees a simulated file change, `verificationRequired` becomes `true`
- before a successful check, `finalResponse.allowed` is `false`
- after a successful `pi_rindaman_check`, `checkFreshness` is `fresh`

Use the existing test harness and `tool_call` / `tool_result` listeners if the harness needs to capture them.

**Step 2: Run test to verify it fails**

Run: `node --test test/extension.test.mjs`
Expected: FAIL until listeners are exercisable or helper extraction is complete

**Step 3: Write minimal implementation**

Create `extensions/pi-rindaman/state.ts`:

```ts
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { RINDAMAN_STATE_ENTRY } from "./constants.ts";
import type { SessionQualityState } from "./types.ts";

const sessionStates = new Map<string, SessionQualityState>();
const sessionEnabledStates = new Map<string, boolean>();

export const getSessionId = (ctx: ExtensionContext) => ctx.sessionManager.getSessionFile() ?? "default";
export const getSessionState = (sessionId: string): SessionQualityState => { /* move existing logic */ };
export const getSessionEnabled = (sessionId: string) => sessionEnabledStates.get(sessionId) ?? true;
export const setSessionEnabled = (sessionId: string, enabled: boolean) => { sessionEnabledStates.set(sessionId, enabled); };
export const persistState = (pi: ExtensionAPI, sessionId: string) => { /* move existing logic */ };
export const restoreState = (ctx: ExtensionContext) => { /* move existing logic */ };
export const readChangedFiles = (directory: string) => { /* move existing logic */ };
export const updateChangedFiles = (state: SessionQualityState, cwd: string) => { /* move existing logic */ };
export const addChangedFile = (state: SessionQualityState, filePath?: string) => { /* add unique path + dirty flag */ };
```

Create `extensions/pi-rindaman/gating.ts`:

```ts
import type { CheckFreshness, FinalResponseGate, SessionQualityState } from "./types.ts";

export const isVerificationRequired = (state: SessionQualityState) => state.changedFiles.length > 0;
export const createFinalResponseGate = (state: SessionQualityState, enabled: boolean): FinalResponseGate => { /* move existing logic */ };
export const getCheckFreshness = (state: SessionQualityState): CheckFreshness => { /* move existing logic */ };
export const getNextAction = (verificationRequired: boolean, checkFreshness: CheckFreshness, finalResponse: FinalResponseGate) => { /* move existing logic */ };
```

Update `extensions/pi-rindaman.ts` to call these helpers.

**Step 4: Run test to verify it passes**

Run: `node --test test/extension.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add extensions/pi-rindaman.ts extensions/pi-rindaman/state.ts extensions/pi-rindaman/gating.ts test/extension.test.mjs
git commit -m "refactor: extract pi-rindaman state and gating"
```

### Task 5: Extract tool execution and status serialization

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Create: `extensions/pi-rindaman/check-tool.ts`
- Create: `extensions/pi-rindaman/status.ts`
- Modify: `extensions/pi-rindaman.ts:230-239,340-466`
- Test: `test/extension.test.mjs`

**Step 1: Write the failing test**

Add tests that assert:
- `pi_rindaman_check` text output includes `Final response allowed:` and `Check freshness:`
- `pi_rindaman_status` JSON includes `changedFiles`, `lastCheck.status`, `nextAction.reason`

**Step 2: Run test to verify it fails**

Run: `node --test test/extension.test.mjs`
Expected: FAIL until extraction preserves output shape exactly

**Step 3: Write minimal implementation**

Create `extensions/pi-rindaman/check-tool.ts`:

```ts
import { spawnSync } from "node:child_process";
import { getCliPath } from "./constants.ts";
import type { CheckToolParams, SessionQualityState } from "./types.ts";

export const buildCheckCommandArgs = (params: CheckToolParams) => { /* move existing logic */ };
export const runCheckTool = (cwd: string, params: CheckToolParams) => {
  const commandArgs = buildCheckCommandArgs(params);
  const result = spawnSync("node", commandArgs, { cwd, encoding: "utf8" });
  return { commandArgs, result };
};
```

Create `extensions/pi-rindaman/status.ts`:

```ts
import { createFinalResponseGate, getCheckFreshness, getNextAction, isVerificationRequired } from "./gating.ts";
import type { SessionQualityState } from "./types.ts";

export const createStatusPayload = (state: SessionQualityState, enabled: boolean) => { /* shape from current tool */ };
export const createCheckSummaryText = (stdout: string, stderr: string, state: SessionQualityState, enabled: boolean) => { /* shape from current tool */ };
```

Update `extensions/pi-rindaman.ts` to use these helpers and shrink the main function to wiring only.

**Step 4: Run test to verify it passes**

Run: `node --test test/extension.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add extensions/pi-rindaman.ts extensions/pi-rindaman/check-tool.ts extensions/pi-rindaman/status.ts test/extension.test.mjs
git commit -m "refactor: extract pi-rindaman tool execution"
```

### Task 6: Add direct quality-engine integration coverage

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `test/cli.test.mjs`
- Test: `test/cli.test.mjs`

**Step 1: Write the failing test**

Add tests in `test/cli.test.mjs` that assert:
- `check --json --all` reports the semantic check command containing `src/quality-engine/engine.cjs`
- `npm pack --dry-run --json` still includes `src/quality-engine/engine.cjs`
- direct `node src/quality-engine/engine.cjs` execution exits successfully from the package root

Example test shape:

```js
test("CLI semantic check executes the bundled quality engine", () => {
  const result = runCli(["check", "--json", "--all"], packageDirectory);
  assert.equal(result.status, 0);
  const output = parseJsonOutput(result);
  const semanticCheck = findCheck(output, "semantic");
  assert.match(semanticCheck.command, /src[\\/]quality-engine[\\/]engine\.cjs/);
  assert.equal(semanticCheck.status, "passed");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.mjs`
Expected: FAIL until the assertions are aligned with actual output or existing test coverage is extended.

**Step 3: Write minimal implementation**

Update or extend existing tests in `test/cli.test.mjs` without changing CLI behavior unless a real packaging or wiring defect is discovered.

**Step 4: Run test to verify it passes**

Run: `node --test test/cli.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add test/cli.test.mjs
git commit -m "test: cover semantic engine integration"
```

### Task 7: Run package-wide verification and release checks

**TDD scenario:** Trivial change — use judgment

**Files:**
- Modify: none expected
- Test: `test/extension.test.mjs`
- Test: `test/cli.test.mjs`

**Step 1: Write the failing test**

No new test. This is the verification checkpoint.

**Step 2: Run test to verify current state**

Run:

```bash
npm run format:check
npm run typecheck
npm test
npm run release:check
```

Expected: all commands PASS

**Step 3: Write minimal implementation**

If any command fails, fix the smallest root cause only in:
- `extensions/pi-rindaman.ts`
- `extensions/pi-rindaman/*.ts`
- `test/extension.test.mjs`
- `test/cli.test.mjs`

Do not widen scope unless a verification failure proves it is necessary.

**Step 4: Run test to verify it passes**

Run the same command set again:

```bash
npm run format:check
npm run typecheck
npm test
npm run release:check
```

Expected: all commands PASS

**Step 5: Commit**

```bash
git add extensions/pi-rindaman.ts extensions/pi-rindaman/*.ts test/extension.test.mjs test/cli.test.mjs
git commit -m "refactor: modularize extension and verify semantic engine"
```
