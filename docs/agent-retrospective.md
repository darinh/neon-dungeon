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
5. the final protocol-change decision is recorded;
6. the retrospective is attached to the PR, issue, session history, or final
   response where future agents can find the evidence.

## Pre-retrospective checklist

Before writing the retrospective:

1. Verify the current directory is the worktree for the work item, not
   `/home/darin/projects/neon-dungeon`.
2. Record `git worktree list`, `git rev-parse --show-toplevel`,
   `git rev-parse --git-common-dir`, `git status --porcelain`, and
   `git ls-files --others --exclude-standard`.
3. Confirm code-review subagents, if any, have returned and real findings were
   addressed or explicitly rejected.
4. Save the final evidence for reviewers: file list, staged or committed diff,
   checks run, PR/issue links, and incidents.
5. Confirm the main checkout has no active work or untracked files related to
   the task.

## Required inputs

Collect only facts that affect future behavior:

- original request or issue;
- branch and worktree path;
- proof that the retrospective is running from the worktree;
- files changed and PR number, if any;
- pasted final diff or commit range for reviewers;
- checks run and their outcomes;
- review findings, including false positives and why they happened;
- incidents, near misses, user corrections, or places where the agent wasted
  time;
- decisions that changed the plan;
- control-scope classification for any new guard: repo, project-config,
  machine-local, CI, or human process.

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
   also emits a cleanup error, verify the remote state, local branch/worktree
   state, and remaining cleanup separately before claiming completion.
8. **Ask two other LLMs for adversarial critique.** Do this only after code
   reviewers are done and their findings are resolved. Give each retrospective
   reviewer the same pasted evidence and the draft retrospective; do not require
   them to enter the repository or run git. Use different model families when
   available; otherwise use different agent roles. If two LLM reviewers are not
   available because of a tool outage, the work item is blocked, not complete.
   Require concrete findings only: correctness gaps, repeated failure patterns,
   missing guards, and unnecessary ceremony. Reviewers must not mutate git state.
9. **Reconcile the critiques.** Adopt changes that prevent real failures. Reject
   weak suggestions explicitly and briefly.
10. **Change the system.** If the retrospective reveals a durable rule, update the
   relevant persistent artifact immediately from the worktree: `AGENTS.md`,
   project instructions, tests, scripts, or this protocol. Re-read the changed
   artifact and verify the guard actually landed.
11. **Final mandatory question: should this retrospective protocol change?** If
   yes, edit this document as part of the same work item or the next immediate
   policy PR. If no, record that no protocol change was needed and why. The
   agent performing the retrospective may edit, commit, and push protocol
   changes from the worktree; the two retrospective reviewers may not.

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
- **Control scopes**:
- **Post-merge verification**:
- **Two-LLM critique**: [reviewers/models used, adopted findings, rejected findings]
- **System changes made**:
- **Protocol change needed**:
```

Store the output where it will influence future work:

- task-specific retrospectives may live in the PR body, issue comment, or session
  history;
- PR work should get a PR comment or PR body entry so the evidence stays attached
  to the merged artifact;
- durable process changes must be applied to `AGENTS.md`, project instructions,
  tests, scripts, or this file;
- do not create permanent repo clutter for one-off notes.
