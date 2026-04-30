---
name: pi-rindaman
description: Strict response discipline plus lifecycle verification tools for implementation and completion. Use when you want verification readiness, final-response gating, and quality checks in a session.
---

# pi-rindaman

`pi-rindaman` is a Pi skill and extension package for verification-aware coding sessions.

It provides:
- strict, concise response discipline
- verification-before-completion behavior
- Pi tools for session quality status and checks
- a local CLI for project quality verification

It does not provide planning, orchestration, brainstorming, or workflow methodology. Those concerns belong to workflow packages such as `pi-superpowers-plus`.

## Package installed? Verify it first

1. Run `pi list`
2. Run `/reload` or restart Pi
3. Confirm these surfaces are available:
   - `/pi-rindaman on`
   - `/pi-rindaman off`
   - `/strict on`
   - `/strict off`
   - `pi_rindaman_status`
   - `pi_rindaman_check`
4. Run `pi_rindaman_status`

The first proof is that the package is loaded and responding.

## What the extension provides

When the package is installed, the bundled Pi extension adds:
- `/pi-rindaman on`
- `/pi-rindaman off`
- `/strict on`
- `/strict off`
- `pi_rindaman_check`
- `pi_rindaman_status`

## Verification workflow

Before claiming completion after code changes:

1. Run `pi_rindaman_status`
2. If verification is needed, run `pi_rindaman_check`
3. Only claim completion when status shows final response is allowed

Typical flow:

```text
pi_rindaman_status
pi_rindaman_check
pi_rindaman_status
```

## Final response contract

When pi-rindaman is active, final responses should include:
- changed files
- verification commands run
- results
- remaining risks or skipped checks

If verification is still pending or failed, say so explicitly.

## CLI

From the project root, the CLI can also be run directly:

```bash
pi-rindaman
pi-rindaman check --json
pi-rindaman audit --json
pi-rindaman doctor --json
```

## Package install

Install as a Pi user package:

```bash
pi install git:github.com/mahdyarief/pi-rindaman
```

Local checkout install also works:

```bash
pi install .
```

Then `pi list` should show either the git package source or the local path, depending on how you installed it. After install, run `/reload` before expecting `pi_rindaman_status` or `pi_rindaman_check` to appear.
