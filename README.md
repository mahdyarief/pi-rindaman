# pi-rindaman

Pi package and CLI for strict response discipline, lifecycle verification, and project quality checks.

![pi-rindaman](./pi-rindaman.png)

## What this package is

`pi-rindaman` is now a Pi-first package.

It provides:
- a Pi extension at `extensions/pi-rindaman.ts`
- a Pi skill at `skills/pi-rindaman/SKILL.md`
- a local CLI at `bin/pi-rindaman.cjs`

This repository no longer presents the legacy plugin runtime as a public surface.

## Install in Pi

Install as a user package:

```bash
pi install git:github.com/mahdyarief/pi-rindaman
```

Install from a local checkout:

```bash
pi install .
```

Install project-locally:

```bash
pi install -l .
```

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

## Expected `pi list`

Git install:

```text
User packages:
  git:github.com/mahdyarief/pi-rindaman
    C:\Users\Lenovo\.pi\agent\git\github.com\mahdyarief\pi-rindaman
```

Local install:

```text
User packages:
  C:\path\to\pi-rindaman
```

## What Pi loads

### Skill

- `skills/pi-rindaman/SKILL.md`

Provides:
- `/skill:pi-rindaman`

### Extension

- `extensions/pi-rindaman.ts`

Provides:
- `/pi-rindaman on`
- `/pi-rindaman off`
- `/pi-rindaman mode core`
- `/pi-rindaman mode senior`
- `/pi-rindaman mode reviewer`
- `/pi-rindaman mode auto`
- `/quality on`
- `/quality off`
- `/strict on`
- `/strict off`
- `pi_rindaman_check`
- `pi_rindaman_status`

## Modes

- `core` - governance only
- `senior` - governance plus implementation-oriented engineering guidance
- `reviewer` - governance plus findings-first review guidance
- `auto` - governance always, layer chosen from request intent

## Verification workflow in Pi

When code changed:

1. run `pi_rindaman_status`
2. if verification is required, run `pi_rindaman_check`
3. run `pi_rindaman_status` again
4. only claim done when `finalResponse.allowed` is `true`

## CLI

Run from the project root:

```bash
pi-rindaman
pi-rindaman check --json
pi-rindaman audit --json
pi-rindaman baseline --json
pi-rindaman doctor --json
```

Target an explicit repo root from another directory:

```bash
pi-rindaman check --json --project-root /path/to/project
pi-rindaman doctor --json --project-root /path/to/project
```

## Development

```bash
npm install
npm test
npm run format:check
npm run knip
```

## Release verification

```bash
npm run release:check
```

This now verifies:
- tests
- package doctor
- package-wide `check --json --all`
- package-wide `audit --json --all`
- npm pack dry-run output

## Package structure

```text
pi-rindaman/
├── bin/
├── extensions/
│   └── pi-rindaman.ts
├── skills/
│   └── pi-rindaman/
│       └── SKILL.md
├── src/
│   └── quality-engine/
├── test/
└── package.json
```

## Notes

- discoverable through the `pi` manifest and `pi-package` keyword
- Pi loads the extension directly from TypeScript
- the extension imports `@sinclair/typebox`, so that package is declared as a peer dependency
