# pi-rindaman

Pi package and CLI for strict response discipline, lifecycle verification, and project quality checks.

## What this package is

`pi-rindaman` is now a Pi-first package.

It provides:
- a Pi extension at `extensions/rindaman.ts`
- a Pi skill at `skills/rindaman/SKILL.md`
- a local CLI at `bin/rindaman.cjs`

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

- `skills/rindaman/SKILL.md`

Provides:
- `/skill:rindaman`

### Extension

- `extensions/rindaman.ts`

Provides:
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
- `rindaman_check`
- `rindaman_status`

## Modes

- `core` - governance only
- `senior` - governance plus implementation-oriented engineering guidance
- `reviewer` - governance plus findings-first review guidance
- `auto` - governance always, layer chosen from request intent

## Verification workflow in Pi

When code changed:

1. run `rindaman_status`
2. if verification is required, run `rindaman_check`
3. run `rindaman_status` again
4. only claim done when `finalResponse.allowed` is `true`

## CLI

Run from the project root:

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
npm test
```

## Package structure

```text
pi-rindaman/
├── bin/
├── extensions/
│   └── rindaman.ts
├── skills/
│   └── rindaman/
│       └── SKILL.md
├── src/
│   └── quality-engine/
├── test/
└── package.json
```

## Notes

- discoverable through the `pi` manifest and `pi-package` keyword
- Pi loads the extension directly from TypeScript
- `typebox` is declared as the Pi extension peer dependency expected by Pi docs
