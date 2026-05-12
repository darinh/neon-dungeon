# Agent Retrospective Protocol

This protocol exists to make agent work improve after every completed work item.
It is not a status report, apology template, or ceremony. It is a short
evidence-based loop that turns mistakes, near misses, and successful patterns
into changed behavior.

## When to run it

Run a retrospective before considering any work item complete. For this protocol,
a work item is one merged PR, one closed issue, one delivered user request, one
self-contained refactor extraction, or one declared external blocker.

A retrospective is required when one of these is true:

- a PR is merged;
- an issue or requested task is delivered;
- a coherent iteration of a larger refactor is finished;
- work stops because it is blocked by an external condition.

Do not run separate retrospectives for individual commits, transient CI waits, or
protocol-only edits made by a parent retrospective. Protocol changes ride the
parent work item to avoid recursive ceremony.

Do not use a retrospective to reboot the session or avoid continuing concrete
work. If there is a next work item in scope, run the retrospective, apply any
process changes, then continue from the proper worktree.

## Completion gate

A work item is not complete until:

1. the retrospective is written from pasted evidence;
2. both LLM retrospective reviewers have returned;
3. adopted and rejected reviewer findings are recorded;
4. any required system changes are applied and verified;
5. repeated incidents and tool incompatibilities have either produced a concrete
   recurrence-prevention guard or have an explicit evidence-backed reason for no
   new guard;
6. the two-LLM critique status is final (`complete`, or `not required` only when
   this protocol says critique is not required). Never leave a completed
   retrospective with critique status `pending`;
7. the final protocol-change decision is recorded;
8. the retrospective is attached to the PR, issue, session history, or final
   response where future agents can find the evidence;
9. the implementation worktree is still available for inspection. Worktree
   cleanup is the final step after the retrospective is attached. If the
   implementation worktree was already removed, record that as a process
   violation and use a fresh worktree only to repair the protocol or attach
   evidence;
10. the agent has checked for the next actionable work item and either started it
    or recorded why no concrete work remains. Do not call `task_complete` merely
    because one PR, issue, or retrospective is done. For issue-backed work, run
    `npm run check:agent-continuity -- --issue <number>` and treat a nonzero exit
    as proof that work remains.

## Required pre-verification controls

Run and record these before verification or review:

1. **Fresh-worktree bootstrap.** If `node_modules` or another expected local
   dependency directory is absent, run the repository's existing install command
   (`npm ci` for this project) before using test failures as evidence.
2. **New-runtime-file surface audit.** Any new browser runtime source file must
   be checked against all registration surfaces: `index.html`,
   `scripts/manifest.js`, service-worker precache, source-file helpers, tests,
   and docs. Default helper paths such as `readSourceFiles()` must cover the new
   file when it is part of the runtime source set.
3. **Classic-script runtime proof.** When moving top-level globals between
   classic scripts, record why the chosen script order is safe: dependencies
   loaded before the new file, callers loaded or executed after it, and no
   module-evaluation-time call path that can reference the moved global early.
4. **Moved-symbol source audit.** Before the first full gate on any extraction
   from `src/entities.js` or another classic-script monolith, search tests,
   source helpers, docs, and runtime files for the moved symbol and the old file
   path. Update direct source-text assertions, shared source loaders, and
   alignment helpers before treating full-gate failures as surprising. Source
   tests for moved prototype methods with nested blocks must use brace-walked
   extraction or a stable terminator, never indentation-only closing-brace
   regexes such as `\n\s{2}\}`.
5. **False-positive evidence.** Any reviewer finding rejected as a false positive
   must be backed by a code citation, test, or runtime-order proof so the same
   concern does not get relitigated without new evidence.
6. **Extension/trigger path proof.** Any extension or trigger scaffolding must
   record the resolved file path, verify it lives under the implementation
   worktree, verify whether the path is ignored, and prove the committed project
   extension is tracked. If a live user-scope extension is installed to protect
   the current session, record which extension path/scope is active after reload
   and which copy is authoritative.

## Pre-retrospective checklist

Before writing the retrospective:

1. Verify the current directory is the implementation worktree for the work item,
   not `/home/darin/projects/neon-dungeon`.
2. Record `git worktree list`, `git rev-parse --show-toplevel`,
   `git rev-parse --git-common-dir`, `git status --porcelain`, and
   `git ls-files --others --exclude-standard`.
3. Confirm code-review subagents, if any, have returned and real findings were
   addressed or explicitly rejected.
4. Save the final evidence for reviewers: file list, staged or committed diff,
   checks run, PR/issue links, and incidents.
5. Confirm the main checkout has no active work or untracked files related to
   the task.
6. Check the active backlog or issue queue before stopping; if work remains,
   start the next work item from a worktree after attaching the retrospective.
7. Run `npm run check:agent-continuity -- --issue <number>` for issue-backed
   work before any `task_complete`; this standard npm script requires the
   operator guard extension to be present and tracked. If it fails, keep working
   or record a concrete blocker.
   For post-release work, the same check must prove that the `develop:
   squash-only PRs` ruleset still has both its pull-request rule and the admin
   bypass needed for direct force-with-lease alignment after a rebase promotion.
8. If extension or trigger files were created, run a path/scope audit: actual
   path, `git check-ignore`, `git ls-files`, extension reload/list/inspect
   output, and primary-checkout stray-file check.
9. If resuming after a restart, a handoff gap, or a user reference to "last
   session", an issue number, or a prior finding, query session history/checkpoints
   for that reference before assuming the current shell directory is the active
   work context.

## Required inputs

Collect only facts that affect future behavior:

- original request or issue;
- branch and worktree path;
- proof that the retrospective is running from the worktree;
- files changed and PR number, if any;
- pasted final diff or commit range for reviewers;
- checks run and their outcomes;
- fresh-worktree bootstrap status;
- new-runtime-file surface audit, if a runtime file was added or moved;
- classic-script runtime proof, if top-level globals moved;
- review findings, including false positives and why they happened;
- incidents, near misses, user corrections, or places where the agent wasted
  time;
- repeated incidents and the concrete guard adopted, or the evidence-backed
  reason no guard was added;
- tool/version incompatibilities encountered and the canonical fallback command
  shape used afterward;
- decisions that changed the plan;
- next-work decision: started next item, no actionable work, or blocked reason;
- continuity check result: command, exit code, and output;
- control-scope classification for any new guard: repo, project-config,
  machine-local, CI, or human process.
- extension/trigger provenance: scaffold target, active loaded path/scope, and
  whether any user-scope copy is a live-session bootstrap or the durable source
  of truth.

## Retrospective steps

1. **State the outcome.** What shipped, merged, or became blocked? Include the
   persistent artifact: commit, PR, branch, or blocker.
2. **Compare plan to reality.** Identify where the plan held, where it drifted,
   and whether the drift was justified.
3. **Name the failure modes.** Focus on root causes, not excuses. Examples:
   working in the wrong checkout, unclear ownership boundaries, stale tests,
   missing source-map updates, reviewer prompts that allowed mutating git state,
   or verification that checked the wrong thing.
4. **Identify what caught problems.** Record which tests, reviewers, tools, or
   human corrections found real issues.
5. **Identify what should have caught problems earlier.** Add a concrete guard,
   prompt rule, checklist item, test, or workflow change.
6. **Classify controls by scope.** Do not treat all guards as equivalent. Repo
   docs travel with the codebase, project config affects this machine's agents,
   CI blocks remote integration, and machine-local wrappers only protect this
   workstation when they are on `PATH`.
7. **Verify post-merge or post-CLI state.** If a CLI command reports success but
   also emits a cleanup error, or exits nonzero after it may have performed
   remote side effects, verify the remote state, local branch/worktree state,
   and remaining cleanup separately before retrying or claiming completion.
   For `gh pr merge` ambiguity, verify with
   `gh pr view --json state,mergedAt,mergeCommit` before deciding whether the
   merge failed or only local cleanup failed.
   For release promotions, verify `origin/main == origin/develop` after any
   required post-release alignment and record whether repository rules were
   bypassed by the durable admin bypass rather than temporary rule deletion.
   If force-aligning branches after a rebase promotion, record the precondition:
   the branches are patch-equivalent and the force-with-lease protects the
   observed old target SHA.
8. **Verify pre-verification controls.** Confirm bootstrap, runtime-file surface
   audit, classic-script runtime proof, and false-positive evidence were handled
   where applicable.
9. **Check continuity.** Query the active issue/backlog. If actionable work
   remains, the completion action is to start it after attaching this
   retrospective, not to stop or call `task_complete`.
10. **Identify recurrence-prevention changes.** For every repeated incident,
    tool/version mismatch, context-recovery failure, or command with ambiguous
    side effects, name the new guard or explicitly reject adding one with
    evidence. Vague "do better next time" statements are not sufficient.
11. **Ask two other LLMs for adversarial critique.** Do this only after code
    reviewers are done and their findings are resolved. Give each retrospective
    reviewer the same pasted evidence and the draft retrospective; do not require
    them to enter the repository or run git. Use different model families when
    available; otherwise use different agent roles. If two LLM reviewers are not
    available because of a tool outage, the work item is blocked, not complete.
    Require concrete findings only: correctness gaps, repeated failure patterns,
    missing guards, and unnecessary ceremony. Reviewers must not mutate git state.
12. **Reconcile the critiques.** Adopt changes that prevent real failures. Reject
    weak suggestions explicitly and briefly.
13. **Change the system.** If the retrospective reveals a durable rule, update the
    relevant persistent artifact immediately from the worktree: `AGENTS.md`,
    project instructions, tests, scripts, or this protocol. Re-read the changed
    artifact and verify the guard actually landed.
14. **Final mandatory question: should this retrospective protocol change?** Ask
    and answer only after reviewer findings are reconciled. If yes, edit this
    document as part of the same work item or the next immediate policy PR. If
    no, record that no protocol change was needed and why. The agent performing
    the retrospective may edit, commit, and push protocol changes from the
    worktree; the two retrospective reviewers may not.

## Two-LLM critique prompt

Use this structure for both reviewers, with different agents or model families
when available:

```text
You are reviewing a completed NEON DUNGEON work item retrospective.

Constraints:
- Do not edit files.
- Do not `cd` into the repository.
- Do not run any git command.
- Do not run shell commands that write, delete, install, or mutate state.
- Inspect only the pasted evidence.

Task:
Find concrete process failures, missing guards, false confidence, or waste in
the retrospective. Recommend only changes that would prevent recurrence on a
future work item. Also state whether docs/agent-retrospective.md itself should
change.

Facts:
- Original request:
- Worktree path:
- Branch:
- Base branch:
- PR/issue:
- Files changed:
- Checks run:
- Code-review findings:
- Incidents or near misses:
- Repeated incidents and adopted/rejected recurrence-prevention guards:
- Tool/version incompatibilities and canonical fallback commands:
- Bootstrap status:
- Runtime-file surface audit:
- Classic-script runtime proof:
- Next-work decision:
- System changes made:
- Final diff or commit range:
- Control scopes:
- Post-merge or post-CLI verification:

Draft retrospective:
[paste draft]
```

## Output format

Keep the retrospective short enough to be useful:

```markdown
## Retrospective: [work item]

- **Outcome**:
- **Worktree/branch**:
- **What went wrong**:
- **What went right**:
- **Earlier catch**:
- **Bootstrap/surface audit/runtime proof**:
- **Control scopes**:
- **Post-merge verification**:
- **Two-LLM critique**: [reviewers/models used, adopted findings, rejected findings]
- **Recurrence-prevention guards**: [new guards added, or rejected with evidence]
- **System changes made**:
- **Protocol change needed**:
- **Next-work decision**:
```

Store the output where it will influence future work:

- task-specific retrospectives may live in the PR body, issue comment, or session
  history;
- PR work should get a PR comment or PR body entry so the evidence stays attached
  to the merged artifact;
- durable process changes must be applied to `AGENTS.md`, project instructions,
  tests, scripts, or this file;
- do not create permanent repo clutter for one-off notes.
