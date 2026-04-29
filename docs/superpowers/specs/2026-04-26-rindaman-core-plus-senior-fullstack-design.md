# pi-rindaman Core Plus Senior Fullstack Design

## Purpose

pi-rindaman should evolve from a pure quality governor into a unified development operating system. It should govern quality and verification while also providing implementation doctrine for modern web-product engineering.

This increment combines both roles into one plugin without turning pi-rindaman into a stack-specific skill.

## Scope

pi-rindaman remains one plugin and one install, but gains two internal layers:

1. **pi-rindaman Core**
   - strict response mode
   - lifecycle enforcement
   - verification-before-completion
   - CLI checks, debt, baseline, monorepo, and security governance

2. **pi-rindaman Senior Fullstack**
   - framework-agnostic web-product engineering guidance
   - frontend/backend boundary discipline
   - API contract discipline
   - auth/session design discipline
   - domain/data modeling discipline
   - feature architecture guidance
   - testing and release thinking

Activation model:

- Core is always on when pi-rindaman is enabled.
- Senior Fullstack activates automatically for implementation-oriented tasks.
- Senior Fullstack stays quiet for pure verification, release, or status tasks.

Out of scope:

- Hono-specific rules
- Payload-specific rules
- Next.js-specific rules
- Bun-specific commands
- stack-specific file layouts
- new CLI checks in this increment

## Architecture

Add a second injected rule alongside the current core rule:

- `RINDAMAN_RULE` stays the quality governor rule
- add `RINDAMAN_SENIOR_FULLSTACK_RULE` as an optional implementation doctrine rule

Plugin runtime decides whether to inject:

- core only
- or core plus senior-fullstack

The activation decision should be based on task intent inferred from the message stream, not repository stack detection.

## Activation Rules

Activate Senior Fullstack when recent user intent suggests:

- implementing a feature
- changing architecture
- building API/data/auth/UI flows
- designing or modifying product behavior in a web application

Do not activate Senior Fullstack when the task is primarily:

- verification only
- status only
- release or version workflow only
- pure code review without implementation

If intent is mixed, prefer enabling the layer only when implementation is materially part of the request.

## Data Flow

1. Plugin reads message history.
2. Plugin determines whether pi-rindaman is enabled.
3. Plugin determines whether Senior Fullstack guidance should be active.
4. Plugin injects the core rule always when enabled.
5. Plugin injects the senior fullstack rule only when active.
6. `pi_rindaman_status` reports whether the senior fullstack layer is active.

## Error Handling

If task intent cannot be determined, default to core-only behavior.

The senior fullstack activation logic must be conservative; false positives are worse than missed optional guidance because they can overload non-implementation tasks.

## Testing Strategy

Use plugin tests.

Add coverage for:

- implementation-oriented request injects both rules
- review/status/release request injects only core
- existing toggle behavior still works
- `pi_rindaman_status` reports whether senior fullstack guidance is active
- core-only behavior is unchanged when the second layer is inactive

Verification commands:

- `npm run build`
- `npm test`
- `node bin/pi-rindaman.cjs doctor --json`
- `npm pack --dry-run`

## Success Criteria

- pi-rindaman remains one plugin with one coherent identity.
- Core governance remains stable.
- Senior Fullstack guidance is generic and stack-agnostic.
- Activation logic is conservative and test-covered.
- Users get implementation guidance without polluting non-implementation workflows.
