# pi-rindaman Production-Grade Hardening Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Make `pi-rindaman` more production-grade by hardening CLI root resolution, increasing quality-check coverage, and strengthening release verification.

**Architecture:** Keep the current package shape intact: a Pi extension, a CLI entrypoint, and CLI helper modules. Improve reliability by extracting explicit project-root resolution and doctor/check behavior, improve quality coverage by adding local formatter and hygiene tooling plus config, and improve release confidence by extending automated verification around packaging and install surface behavior.

**Tech Stack:** Node.js, CommonJS CLI modules, TypeScript-loaded Pi extension, Biome, Knip, Node test runner, npm packaging.

---

### Task 1: Add failing tests for explicit project-root targeting and root resolution

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Modify: `test/cli.test.mjs`
- Modify: `bin/pi-rindaman.cjs`
- Test: `test/cli.test.mjs`

**Step 1: Write the failing test**

Add tests covering:
- `pi-rindaman check --json --project-root <path>` uses the provided root instead of `process.cwd()` walk-up
- `pi-rindaman doctor --json --project-root <path>` reports against the provided root
- invalid `--project-root` returns structured JSON error

**Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.mjs`
Expected: FAIL because `--project-root` is not implemented

**Step 3: Write minimal implementation**

Implement:
- `readProjectRootFlag()` in `src/cli/args.cjs`
- explicit root validation in `bin/pi-rindaman.cjs`
- shared `resolveProjectRoot()` flow used by `check`, `baseline`, and `doctor`

**Step 4: Run test to verify it passes**

Run: `node --test test/cli.test.mjs`
Expected: PASS for new root-resolution tests

**Step 5: Commit**

```bash
git add test/cli.test.mjs src/cli/args.cjs bin/pi-rindaman.cjs
git commit -m "feat: support explicit project root selection"
```

### Task 2: Harden doctor/check visibility around config and skipped quality coverage

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Modify: `test/cli.test.mjs`
- Modify: `src/cli/check-runner.cjs`
- Modify: `bin/pi-rindaman.cjs`
- Test: `test/cli.test.mjs`

**Step 1: Write the failing test**

Add tests covering:
- `doctor --json` reports detected config files and effective formatter/hygiene availability
- `check --json --strict` fails when syntax or hygiene are skipped
- skipped checks include actionable reason text

**Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.mjs`
Expected: FAIL because doctor/check output lacks the new fields or stricter behavior assertions

**Step 3: Write minimal implementation**

Implement:
- helper functions for config file detection
- doctor output fields for config discovery
- consistent skipped-check reasons for formatter/hygiene tooling
- verify `strict` handling remains explicit and deterministic in JSON output

**Step 4: Run test to verify it passes**

Run: `node --test test/cli.test.mjs`
Expected: PASS for doctor/check visibility tests

**Step 5: Commit**

```bash
git add test/cli.test.mjs src/cli/check-runner.cjs bin/pi-rindaman.cjs
git commit -m "feat: expose quality coverage diagnostics"
```

### Task 3: Add local formatter and unused-code tooling so package self-checks cover more

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: `package.json`
- Create: `biome.json`
- Create: `knip.json`
- Modify: `README.md`
- Test: `test/cli.test.mjs`

**Step 1: Run existing tests first**

Run: `node --test test/cli.test.mjs`
Expected: PASS before tooling changes

**Step 2: Add or adjust tests**

Add assertions that package-level `doctor --json` reports formatter config and local binaries as present after tooling is declared.

**Step 3: Write minimal implementation**

Implement:
- `devDependencies` for `@biomejs/biome` and `knip`
- scripts for `format:check` and `knip`
- `biome.json` with minimal formatting/lint scope
- `knip.json` tuned to this package structure
- README note describing the stronger local verification surface

**Step 4: Run tests to verify they pass**

Run: `node --test test/cli.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json package-lock.json biome.json knip.json README.md test/cli.test.mjs
git commit -m "chore: add local formatter and hygiene tooling"
```

### Task 4: Strengthen release verification and packaging tests

**TDD scenario:** New feature — full TDD cycle

**Files:**
- Modify: `test/cli.test.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Test: `test/cli.test.mjs`

**Step 1: Write the failing test**

Add tests covering:
- `npm pack --dry-run --json` includes extension, skill, CLI, and quality-engine files
- release-check script includes package verification commands

**Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.mjs`
Expected: FAIL because packaging assertions or release script expectations are not yet satisfied

**Step 3: Write minimal implementation**

Implement:
- stronger `release:check` script including `check --json`, `audit --json`, and `npm pack --dry-run --json`
- package test assertions against pack output
- README release-verification section

**Step 4: Run test to verify it passes**

Run: `node --test test/cli.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add test/cli.test.mjs package.json README.md
git commit -m "test: verify release package surface"
```

### Task 5: Verify the whole repo with production-grade checks

**TDD scenario:** Modifying tested code — run existing tests first

**Files:**
- Modify: none unless verification exposes defects
- Test: package verification commands

**Step 1: Run full automated verification**

Run:
```bash
npm test
npm run doctor -- --json
node bin/pi-rindaman.cjs check --json --all
node bin/pi-rindaman.cjs audit --json --all
npm pack --dry-run --json
```
Expected: all pass; check/audit may still show warnings only if intentionally configured

**Step 2: Fix any failing verification at root cause**

If a command fails, update the minimal relevant source or config and rerun only the affected command first, then rerun the full suite.

**Step 3: Run final verification again**

Run the full command set again.
Expected: PASS

**Step 4: Commit**

```bash
git add .
git commit -m "chore: harden production verification"
```
