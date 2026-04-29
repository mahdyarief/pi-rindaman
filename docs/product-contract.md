# pi-rindaman Product Contract

## Identity

`pi-rindaman` is a Pi verification package with a companion local CLI.

It owns:
- strict response discipline
- verification-before-completion behavior
- final-response gating
- CLI-backed quality, debt, baseline, workspace, and security checks

It does not own:
- brainstorming
- implementation planning
- orchestration of execution phases
- general workflow monitoring methodology
- review-process frameworks

Those concerns belong in separate workflow packages such as `pi-superpowers-plus`.

## Pi Surfaces

### Extension

The package provides a Pi extension that adds:
- session toggles
- `pi_rindaman_check`
- `pi_rindaman_status`
- verification-aware session behavior

### Skill

The package provides a Pi skill:
- `/skill:pi-rindaman`

### CLI

The package provides these stable CLI surfaces:
- `check`
- `audit`
- `baseline`
- `doctor`

## Commands

Stable Pi command surfaces:
- `/pi-rindaman on`
- `/pi-rindaman off`
- `/strict on`
- `/strict off`

## Status Contract

Canonical status concepts:
- `enabled`
- `strictResponses`
- `qualityLifecycle`
- `verificationRequired`
- `checkFreshness`
- `nextAction`
- `changedFiles`
- `lastCheck`
- `finalResponse`

## Stability Levels

### Stable

- tool names
- top-level CLI commands
- documented Pi command names
- top-level `pi_rindaman_status` contract semantics
- verification and final-response gating behavior

### Experimental

- exact system-prompt wording
- exact skip/failure reason phrasing
- internal state persistence shape beyond the documented status semantics

## Documentation Contract

Current product-facing docs:
- `docs/README.md`
- `docs/product-contract.md`
- `docs/releasing.md`

Historical overlap-era planning and design files are archived under `docs/archive/overlap-era/` and are not part of the active package contract.

## Composition Contract

`pi-rindaman` is designed to compose with workflow packages.

Expected composition:
- workflow package decides how work is planned and executed
- `pi-rindaman` decides whether completion is verified and safe to claim

If both packages are installed:
- workflow package owns planning and orchestration
- `pi-rindaman` owns verification readiness and final-response discipline
