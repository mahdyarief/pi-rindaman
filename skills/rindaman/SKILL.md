---
name: rindaman
description: Strict response discipline plus lifecycle verification guidance for implementation, review, and completion. Use when you want Rindaman's Pi workflow, commands, and quality tools in a session.
---

# Rindaman

Rindaman is a Pi skill and extension package for code-quality governance.

It combines:
- strict, concise response discipline
- implementation and review guidance layers
- verification-before-completion behavior
- Pi tools for session quality status and checks

## What the extension provides

When the package is installed, the bundled Pi extension adds:
- `/rindaman on`
- `/rindaman off`
- `/rindaman mode core`
- `/rindaman mode senior`
- `/rindaman mode reviewer`
- `/rindaman mode auto`
- `/quality on` / `/quality off`
- `/strict on` / `/strict off`
- `rindaman_check`
- `rindaman_status`

## Modes

- `core` — governance only
- `senior` — governance plus implementation-oriented senior-engineer guidance
- `reviewer` — governance plus findings-first review guidance
- `auto` — governance always, secondary layer chosen from request intent

In `auto` mode:
- implementation + engineering context activates the senior layer
- review-oriented prompts activate the reviewer layer
- generic status/release/governance prompts stay core-only

## Verification workflow

Before claiming completion after code changes:

1. Run `rindaman_status`
2. If verification is needed, run `rindaman_check`
3. Only claim completion when status shows final response is allowed

Typical flow:

```text
rindaman_status
rindaman_check
rindaman_status
```

## Final response contract

When Rindaman is active, final responses should include:
- changed files
- verification commands run
- results
- remaining risks or skipped checks

If verification is still pending or failed, say so explicitly.

## CLI

From the project root, the CLI can also be run directly:

```bash
rindaman
rindaman check --json
rindaman audit --json
rindaman doctor --json
```

## Package install

Install as a Pi user package:

```bash
pi install git:github.com/mahdyarief/rindaman
```

Local checkout install also works:

```bash
pi install .
```

Then `pi list` should show either the git package source or the local path, depending on how you installed it.
