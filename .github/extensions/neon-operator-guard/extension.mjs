// Extension: neon-operator-guard
// Project guardrails for NEON DUNGEON autonomous operator workflow.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession } from "@github/copilot-sdk/extension";

const ISSUE_NUMBER = "578";
const PRIMARY_CHECKOUT = "/home/darin/projects/neon-dungeon";
const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(EXTENSION_DIR, "../../..");
const CONTINUITY_SCRIPT = resolve(PROJECT_ROOT, "scripts/agent-continuity-check.js");
const DANGEROUS_MAIN_CHECKOUT_GIT =
    /\bgit\s+(?:add|am|apply|bisect|branch\s+(?:-[dD]|--delete)|checkout|cherry-pick|clean|commit|merge|mv|pull|push|rebase|reset|restore|revert|rm|stash|switch|tag\s+(?:-[dD]|--delete)|worktree\s+(?:add|move|prune|remove|repair))\b/;

function execFileText(command, args, options = {}) {
    return new Promise((resolvePromise) => {
        execFile(command, args, options, (error, stdout, stderr) => {
            resolvePromise({
                exitCode: typeof error?.code === "number" ? error.code : 0,
                stdout: String(stdout || ""),
                stderr: String(stderr || ""),
            });
        });
    });
}

function cwdIsPrimaryCheckout(cwd) {
    return resolve(String(cwd || ".")) === PRIMARY_CHECKOUT;
}

function commandTargetsPrimaryCheckout(command) {
    return String(command || "").includes(PRIMARY_CHECKOUT);
}

function toolLooksLikeCompletion(toolName) {
    return /task_complete$/.test(String(toolName || ""));
}

function toolLooksLikePatch(toolName) {
    return /apply_patch$/.test(String(toolName || ""));
}

function patchTargetsPrimaryCheckout(toolArgs) {
    return String(toolArgs || "").includes(`*** Update File: ${PRIMARY_CHECKOUT}/`) ||
        String(toolArgs || "").includes(`*** Add File: ${PRIMARY_CHECKOUT}/`) ||
        String(toolArgs || "").includes(`*** Delete File: ${PRIMARY_CHECKOUT}/`);
}

async function runContinuityCheck() {
    if (!existsSync(CONTINUITY_SCRIPT)) {
        return {
            ok: false,
            message: `Continuity guard script is missing at ${CONTINUITY_SCRIPT}.`,
        };
    }

    const result = await execFileText(
        "node",
        [CONTINUITY_SCRIPT, "--issue", ISSUE_NUMBER],
        { cwd: PROJECT_ROOT },
    );
    const output = `${result.stdout}${result.stderr}`.trim();
    return {
        ok: result.exitCode === 0,
        message: output || `Continuity check exited ${result.exitCode}.`,
    };
}

const session = await joinSession({
    hooks: {
        onSessionStart: async () => ({
            additionalContext: [
                "NEON DUNGEON operator guard is active.",
                "Use implementation worktrees for all code edits, commits, PRs, and test runs.",
                `Before calling task_complete or handoff, run npm run check:agent-continuity -- --issue ${ISSUE_NUMBER}; if it fails, continue the next work item instead.`,
            ].join("\n"),
        }),
        onUserPromptSubmitted: async () => ({
            additionalContext: [
                "NEON DUNGEON operator guard reminder: all implementation work belongs in a git worktree, not the primary checkout.",
                `Issue #${ISSUE_NUMBER} continuity is enforceable through npm run check:agent-continuity -- --issue ${ISSUE_NUMBER}.`,
            ].join("\n"),
        }),
        onPreToolUse: async (input) => {
            const toolName = String(input.toolName || "");
            const toolArgs = input.toolArgs;

            if (
                toolLooksLikePatch(toolName) &&
                patchTargetsPrimaryCheckout(toolArgs)
            ) {
                return {
                    permissionDecision: "deny",
                    permissionDecisionReason: "NEON DUNGEON guard: do not patch files in the primary checkout; use an implementation worktree.",
                };
            }

            if (toolName.endsWith("bash")) {
                const command = String(toolArgs?.command || "");
                if (
                    (cwdIsPrimaryCheckout(input.cwd) || commandTargetsPrimaryCheckout(command)) &&
                    DANGEROUS_MAIN_CHECKOUT_GIT.test(command)
                ) {
                    return {
                        permissionDecision: "deny",
                        permissionDecisionReason: "NEON DUNGEON guard: mutating git commands are blocked in the primary checkout; use an implementation worktree.",
                    };
                }
                if (/^\s*handoff\b/.test(command)) {
                    const continuity = await runContinuityCheck();
                    if (!continuity.ok) {
                        return {
                            permissionDecision: "deny",
                            permissionDecisionReason: `NEON DUNGEON guard: handoff is blocked until continuity passes.\n${continuity.message}`,
                        };
                    }
                }
            }

            if (toolLooksLikeCompletion(toolName)) {
                const continuity = await runContinuityCheck();
                if (!continuity.ok) {
                    return {
                        permissionDecision: "deny",
                        permissionDecisionReason: `NEON DUNGEON guard: task_complete is blocked until continuity passes.\n${continuity.message}`,
                    };
                }
            }

            return { permissionDecision: "allow" };
        },
    },
    onPermissionRequest: async () => ({ kind: "approved" }),
    tools: [
        {
            name: "neon_operator_status",
            description: "Runs the NEON DUNGEON continuity guard for issue #578 and reports whether completion is allowed.",
            parameters: { type: "object", properties: {} },
            skipPermission: true,
            handler: async () => {
                const continuity = await runContinuityCheck();
                return {
                    resultType: continuity.ok ? "success" : "failure",
                    textResultForLlm: continuity.message,
                };
            },
        },
    ],
});

await session.log("NEON DUNGEON operator guard loaded.");
