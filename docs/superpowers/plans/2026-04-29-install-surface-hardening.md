# Install Surface Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the published Pi package install surface consistent with the extension runtime imports and document shell-correct installation commands for Windows and Bash users.

**Architecture:** Keep the implementation minimal. Add one regression test that inspects the extension source and package manifest, then update `package.json` so peer dependencies match the actual runtime import. Update `README.md` with shell-specific examples that avoid the invalid mixed-shell commands that caused installation confusion.

**Tech Stack:** Node.js built-in test runner, npm package manifest, Markdown docs

---

### Task 1: Add dependency contract regression test

**Files:**
- Modify: `test/cli.test.mjs`
- Test: `test/cli.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test("package peer dependencies cover extension runtime imports", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(packageDirectory, "package.json"), "utf8"),
  );
  const extensionSource = readFileSync(
    resolve(packageDirectory, "extensions", "pi-rindaman.ts"),
    "utf8",
  );

  assert.match(extensionSource, /from "@sinclair\/typebox"/);
  assert.equal(packageJson.peerDependencies["@sinclair/typebox"], "*");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.mjs`
Expected: FAIL because `packageJson.peerDependencies["@sinclair/typebox"]` is `undefined`

- [ ] **Step 3: Keep the test minimal and package-focused**

```js
test("package peer dependencies cover extension runtime imports", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(packageDirectory, "package.json"), "utf8"),
  );
  const extensionSource = readFileSync(
    resolve(packageDirectory, "extensions", "pi-rindaman.ts"),
    "utf8",
  );

  assert.match(extensionSource, /from "@sinclair\/typebox"/);
  assert.equal(packageJson.peerDependencies["@sinclair/typebox"], "*");
});
```

- [ ] **Step 4: Re-run the test after implementation**

Run: `node --test test/cli.test.mjs`
Expected: PASS

### Task 2: Align package manifest with runtime import

**Files:**
- Modify: `package.json`
- Test: `test/cli.test.mjs`

- [ ] **Step 1: Replace the incorrect peer dependency name**

```json
"peerDependencies": {
  "@mariozechner/pi-ai": "*",
  "@mariozechner/pi-coding-agent": "*",
  "@mariozechner/pi-tui": "*",
  "@sinclair/typebox": "*"
}
```

- [ ] **Step 2: Run the focused test**

Run: `node --test test/cli.test.mjs`
Expected: PASS

### Task 3: Fix install documentation for Windows and Bash users

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add shell-correct repo bootstrap examples**

```md
If you want to clone or enter the repo before a local install, use commands that match your shell.

PowerShell:

```powershell
Set-Location D:\Github
if (Test-Path .\pi-rindaman) {
  Set-Location .\pi-rindaman
} else {
  git clone https://github.com/mahdyarief/pi-rindaman.git
  Set-Location .\pi-rindaman
}
```

Bash:

```bash
if [ -d /d/Github/pi-rindaman ]; then
  cd /d/Github/pi-rindaman
else
  cd /d/Github
  git clone https://github.com/mahdyarief/pi-rindaman.git
  cd pi-rindaman
fi
```
```

- [ ] **Step 2: Clarify the package dependency note**

```md
- Pi loads the extension directly from TypeScript.
- The extension imports `@sinclair/typebox`, so that package is declared as a peer dependency.
```

- [ ] **Step 3: Verify docs stay aligned with package behavior**

Run: `npm pack --dry-run`
Expected: PASS and `README.md` remains in the published tarball

### Task 4: Full verification

**Files:**
- Modify: `package.json`, `README.md`, `test/cli.test.mjs`

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run package publish verification**

Run: `npm pack --dry-run`
Expected: PASS

- [ ] **Step 3: Review changed files**

Run: `git diff -- package.json README.md test/cli.test.mjs docs/superpowers/plans/2026-04-29-install-surface-hardening.md`
Expected: only the planned install-surface changes appear
