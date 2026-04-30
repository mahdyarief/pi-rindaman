import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RINDAMAN_STATE_ENTRY = "pi_rindaman_state";

export const RINDAMAN_RULE = `
pi-rindaman verification mode is enabled.

pi-rindaman is a verification and response-discipline layer. It does not own planning, orchestration, brainstorming, or workflow methodology.

Strict response behavior:
- Be concise and direct.
- Remove filler, pleasantries, and hedging.
- Preserve technical meaning.
- Prefer short, precise wording.
- Never reduce correctness for brevity.
- Do not compress code blocks, commands, logs, stack traces, exact quoted text, paths, environment variables, API names, URLs, or version numbers.

Verification lifecycle:
1. Before editing: restate the task in one sentence, declare the minimal file footprint, and avoid excluded areas.
2. During implementation: enforce domain naming, explicit types or contracts, simple structure, and no speculative code.
3. Before completion: run verification checks when code changed.
4. After failures: fix root causes, not symptoms. Do not silence checks with casts, ignores, mechanical renames, or unrelated deletion.
5. Before final response: report changed files, checks run, and remaining risks.

Boundaries:
- Workflow planning, decomposition, brainstorming, orchestration, and review process ownership belong to separate workflow packages such as pi-superpowers-plus.
- pi-rindaman owns verification readiness, final-response gating, and quality-check execution.

Before completion:
- Run pi-rindaman from the project root when available and code changed.
- If unavailable, run equivalent project checks: typecheck, formatter or linter, and unused-code detection when configured.
- If verification is required and no passing pi_rindaman_check exists, explicitly state verification is pending or failed.
`.trim();

const extensionDirectory = fileURLToPath(new URL(".", import.meta.url));

export const getCliPath = () => resolve(extensionDirectory, "..", "..", "bin", "pi-rindaman.cjs");
