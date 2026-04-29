# rindaman

Pi package and OpenCode plugin for strict response discipline, lifecycle verification, and project quality checks.

## What this package is

Rindaman now supports two use cases from the same repository:

- **Pi package** — install with `pi install ...`, appears in `pi list`, contributes skills and extensions
- **OpenCode plugin** — keep using the existing plugin and CLI behavior

The Pi package shape follows the same package model used by projects like `pi-superpowers-plus`:
- `package.json` includes a `pi` manifest
- `extensions/` contains Pi extension entrypoints
- `skills/` contains Pi skills

## Pi install

Install as a user package:

```bash
pi install git:github.com/mahdyarief/rindaman
```

You can also install from a local checkout:

```bash
pi install .
```

Or install project-locally into `.pi/settings.json`:

```bash
pi install -l .
```

After install, `pi list` should show something like:

```text
User packages:
  git:github.com/mahdyarief/rindaman
    C:\Users\Lenovo\.pi\agent\git\github.com\mahdyarief\rindaman
```

If you installed from the current checkout instead of git, expect a local-path entry instead:

```text
User packages:
  C:\path\to\rindaman
```

## What Pi loads from this package

### Skills

- `skills/rindaman/SKILL.md`

This gives Pi a loadable `/skill:rindaman` workflow entry.

### Extensions

- `extensions/rindaman.ts`

This extension provides:
- session toggles and mode commands
- system-prompt injection for Rindaman guidance
- `rindaman_check`
- `rindaman_status`
- lightweight verification gating for commit/push/PR commands

## Pi commands

After installation, the extension provides these commands:

- `/rindaman on`
- `/rindaman off`
- `/rindaman mode core`
- `/rindaman mode senior`
- `/rindaman mode reviewer`
- `/rindaman mode auto`
- `/quality on`
- `/quality off`
- `/strict on`
- `/strict off`

## Pi tools

### `rindaman_check`

Runs the local CLI from the current project directory and records session check status.

### `rindaman_status`

Returns JSON with:
- enabled state
- mode
- secondary layer
- changed files
- last check state
- next action
- final response gate

## Modes

Rindaman supports four Pi modes:

- `core` - governance only
- `senior` - governance plus implementation-oriented engineering guidance
- `reviewer` - governance plus findings-first review guidance
- `auto` - governance always, layer chosen from request intent

In `auto` mode:
- implementation + engineering context activates the senior layer
- review-oriented prompts activate the reviewer layer
- generic governance/status requests stay core-only

## Verification workflow in Pi

When code changed:

1. run `rindaman_status`
2. if verification is required, run `rindaman_check`
3. run `rindaman_status` again
4. only claim done when `finalResponse.allowed` is `true`

## OpenCode support remains

This repository still includes the existing OpenCode plugin implementation under `src/` and compiled output under `dist/`.

OpenCode CLI usage remains:

```bash
rindaman
rindaman check --json
rindaman audit --json
rindaman baseline --json
rindaman doctor --json
```

## Development

```bash
npm install
npm run build
npm test
```

## Package structure

```text
rindaman/
├── bin/
├── dist/
├── extensions/
│   └── rindaman.ts
├── skills/
│   └── rindaman/
│       └── SKILL.md
├── src/
├── test/
└── package.json
```

## Notes

- The Pi package is discoverable because `package.json` contains the `pi-package` keyword and a `pi` manifest.
- `pi list` shows installed packages from Pi settings; this repo is now shaped for that workflow.
- The Pi extension uses runtime TypeScript loading, so `extensions/rindaman.ts` does not need a separate build step for Pi.
- For Pi package compatibility, this package uses the documented `typebox` peer dependency name expected by Pi extensions.

# pi-rindaman
