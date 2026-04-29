# pi-rindaman Product Contract

## Identity

pi-rindaman is a Pi package with a companion local CLI.

It combines:
- core governance and verification
- optional senior-engineer implementation guidance
- optional reviewer guidance
- CLI-backed quality, debt, baseline, workspace, and security checks

## Pi Surfaces

### Extension

The package provides a Pi extension that adds:
- session toggles
- mode commands
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

## Layers

- **Core** - always-on governance, verification, and final-response discipline
- **Senior Engineer** - implementation-oriented engineering guidance
- **Reviewer** - findings-first review guidance

Core is always active when pi-rindaman is enabled. Senior Engineer and Reviewer are mutually exclusive secondary layers.

## Modes

- `core`
- `senior`
- `reviewer`
- `auto`

Mode precedence:
1. session override command
2. default `auto`

## Status Contract

Canonical status concepts:
- `mode`
- `secondaryLayer`
- `verificationRequired`
- `lastCheck`
- `seniorEngineer`
- `reviewer`
- `finalResponse`

## Stability Levels

### Stable

- tool names
- mode names
- top-level CLI commands
- top-level `pi_rindaman_status` contract semantics
- Pi command names documented in README

### Experimental

- auto activation heuristics
- matched signal details
- exact secondary-layer intent inference

## Product Notes

The `core` layer covers response discipline, verification, and quality governance. The `senior` and `reviewer` layers extend that core with task-specific guidance rather than changing the base contract.
