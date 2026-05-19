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
8. no output field that affects follow-up behavior is left as `pending`; use
   `N/A` only with a reason and only when the field truly does not apply;
   before attachment, scan the final text for placeholders such as `pending`,
   `TODO`, and `TBD` and replace them with a final value or an explicit reason;
9. the retrospective is attached to the PR, issue, session history, or final
   response where future agents can find the evidence;
10. the implementation worktree is still available for inspection. Worktree
    cleanup is the final step after the retrospective is attached. If the
    implementation worktree was already removed, record that as a process
    violation and use a fresh worktree only to repair the protocol or attach
    evidence;
11. the agent has checked for the next actionable work item and either started it
    or recorded why no concrete work remains. Do not call `task_complete` merely
    because one PR, issue, or retrospective is done. For issue-backed work, run
    `npm run check:agent-continuity -- --issue <number>` and treat a nonzero exit
    as proof that work remains.

## Required pre-verification controls

Run and record these before verification or review:

1. **Stale-resume preflight.** Before continuing any branch, worktree, staged
   diff, or handoff/session-history work that predates the current session, has
   not fetched in the current session, or may have fallen behind the target
   branch, run a freshness check before any review request, commit, push, or PR
   action. This guard reinforces the session-start continuity protocol; if the
   agent skipped fetch, issue, PR, or session-history checks, record that as
   protocol non-compliance, not only as a missing guard. The freshness check must
   fetch `origin`, verify any issue is still open and not already completed,
   search open and merged PRs for the same issue, title terms, scope, symbols,
   and file paths, compare the branch point and target-branch commits against
   `origin/develop`, and inspect the target branch for equivalent moved symbols
   or files. Do not rely on title or issue matching alone; symbol, file, and
   behavior equivalence must be checked because duplicate work can land under a
   different path. If the work is closed, superseded, already landed, or
   equivalent upstream, stop immediately before spending reviewer cycles or
   opening a PR; abandon or close the duplicate work and record the evidence.
2. **Review-risk triage.** Before requesting code review, list every changed
   code-bearing path and state whether it matches a red-risk designation or is
   ambiguous enough to use the higher reviewer count. Record the number of
   adversarial reviewers required and used. If a path resembles a red-risk file
   but is intentionally treated differently, cite the exact instruction text or
   choose the safer higher-review path; do not leave applicability implicit.
3. **Fresh-worktree bootstrap.** If `node_modules` or another expected local
   dependency directory is absent, run the repository's existing install command
   (`npm ci` for this project) before recording baseline verification or using
   test failures as evidence. Check and record this bootstrap status before the
   first npm verification command in a fresh implementation worktree.
4. **Bounded command preflight.** Before running repository-wide discovery
   commands in long-lived checkouts, prefer exact queries over broad listings and
   bound any expected-large output with `--no-pager`, `--format`, `--count`, or a
   line limit. Any startup or discovery command expected to print more than 50
   lines must be narrowed before it runs, not after the pager opens; examples are
   `git branch --list 'pattern' --no-column`, a bounded `git worktree list
   --porcelain` pipeline, or a targeted `gh pr list --limit N --json ... --jq ...`.
   Startup and continuity git inspection must be bounded in the command itself:
   use `git --no-pager` plus counts, explicit ref patterns, `--format`, or a
   line-limited pipeline. Before constructing any startup/continuity bash batch,
   enumerate every proposed discovery command against this boundedness rule; do
   not assemble or execute the batch until each command has a count-only,
   narrowed, or line-limited form and a recorded bounded/unbounded classification.
   Never display raw `git branch --no-merged ...` output in startup or continuity
   preflight. If unmerged-branch information is needed, use a count
   (`GIT_PAGER=cat git branch --no-merged <base> | wc -l`) or a narrowed
   pattern/list with `--no-column` and an explicit line limit in the same
   command. Never display raw `git worktree list` output in startup or
   continuity preflight; use `git worktree list --porcelain | sed -n '1,80p'`,
   `git worktree list --porcelain | grep -c '^worktree '`, or another explicit
   line/count bound. Before executing any startup or continuity command
   containing `git branch --no-merged` or `git worktree list`, inspect the
   command string itself: if it does not also contain an output bound such as
   `wc -l`, `grep -c`, `sed -n '1,20p'`, `head`, `--porcelain`, or an explicit
   narrowed `--list '<pattern>' --no-column`, rewrite it before it runs. A
   remembered warning about broad branch or worktree listings is not sufficient
   mitigation after a repeat pager incident.
   Use tool names that are known to exist in this environment (`python3`, not
   `python`) or preflight them with `command -v`. For startup continuity checks,
   do not run unbounded branch/worktree/history listings; use targeted commands
   such as `git for-each-ref --format='%(refname:short)' refs/heads/<prefix>`,
   `git branch --list '<pattern>' --no-column`, or `gh pr list --limit N --json`.
   Treat a command that pages through stale branches, worktrees, or history as a
   process miss and replace it with a narrower query before continuing. If the
   same pager class recurs after this guard was already in force, record why the
   documented guard failed and add a stronger repo, extension, or shell-level
   prevention instead of only restating the rule.
5. **Focused-test command scope.** Before describing a verification command as
   focused, check how package scripts forward arguments. In this repository,
   `npm test -- tests/foo.test.js` still runs the package script
   `node --test tests/*.test.js`; use `node --test tests/foo.test.js` for a
   truly file-focused run, or record that the command actually executed the full
   test glob.
6. **CI failure classification.** Before changing code, workflows, or release
   state for a failed check, read the failed job log and classify the failure as
   checkout/runner infrastructure, dependency/bootstrap, or product code. For
   self-hosted runner checkout failures, inspect the runner workspace cache
   first; corrupt object or checkout-cache failures should be repaired and rerun
   before any repository change is considered.
7. **New-runtime-file surface audit.** Any new browser runtime source file must
   be checked against all registration surfaces: `index.html`,
   `scripts/manifest.js`, service-worker precache, source-file helpers, tests,
   and docs. Default helper paths such as `readSourceFiles()` must cover the new
   file when it is part of the runtime source set.
8. **Classic-script runtime proof.** When moving top-level globals between
   classic scripts, record why the chosen script order is safe: dependencies
   loaded before the new file, callers loaded or executed after it, and no
   module-evaluation-time call path that can reference the moved global early.
   Label each proof as executed runtime evidence or static/order inference; if
   no executed runtime path was run, record why static proof is sufficient.
   Before the first full gate for a new classic-script runtime file, enumerate
   every free/global helper, prototype helper, and runtime collection the moved
   code references, cite where each dependency is defined, and verify each
   definition loads before the new file or is only called after the dependency
   is initialized. Manifest/source equality alone is not dependency proof.
9. **Moved-symbol source audit.** Before the first full gate on any extraction
   from `src/entities.js` or another classic-script monolith, search tests,
   source helpers, docs, runtime files, and `types/*.d.ts` declarations for the
   moved symbol and the old file path. Update direct source-text assertions,
   shared source loaders, type surfaces, `types/*.d.ts` members, JSDoc field or
   `@type` annotations, and alignment helpers before treating full-gate failures
   as surprising. Run this audit immediately after the code move and before the
   first full check, and record an explicit surface list in the evidence
   (`source`, `tests`, `types`, `docs/spec`, and runtime registration surfaces)
   with each surface marked checked or updated. For moved prototype methods, the
   audit must explicitly confirm the corresponding `types/*.d.ts` interface
   contains the moved method name before the first full check. Re-run this
   surface audit after any rebase or conflict resolution that touches source
   inventories, docs, type declarations, or the moved symbol's new/old files. Source
   tests for moved prototype methods with nested blocks must use brace-walked
   extraction or a stable terminator, never indentation-only closing-brace
   regexes such as `\n\s{2}\}`. When converting class methods to prototype
   assignments, use named `function` expressions and verify no arrow function
   replaced a method that depends on dynamic `this`. Static checks and source
   greps are not enough for a moved dispatch path: identify which test exercises
   the new path through the runtime receiver/export/event handler. If none does,
   add a focused behavioral smoke test before review. This evidence must name
   the test file and test case before review; a blank or source-only answer is a
   blocker. For AI smoke tests, enumerate the moved function's guard, timer, and
   range/branch decisions and either cover each one or record why a branch is
   intentionally out of scope. For prototype helpers, also verify the helper is
   callable from an instance so class-field shadowing cannot pass source-only
   tests. Preserve domain comments and invariant notes from moved blocks, or
   record why each omitted comment is obsolete; semantic comments are behavior
   evidence, not formatting. Before review, perform a moved-code fidelity pass:
   compare each moved block against the source block and document every
   intentional textual change, including comments, punctuation, Unicode
   arrows/dashes, and inline notes. The fidelity pass must
   leave an auditable receipt before review: record the old source range, new
   source range, comparison command or method, and every intentional textual
   delta. If the comparison is expected to be identical except for wrapper
   conversion or comment normalization, say that explicitly. For extracted domain
   behavior, require at least one review pass to check invariant/comment
   preservation explicitly instead of relying only on generic code review. VM
   behavior tests for extracted AI must use production tuning constants by
   loading or parsing the production source; if a synthetic value is intentional,
   name and comment it as a synthetic fixture so it is not mistaken for behavior
   parity.
10. **Engine-surface export checklist.** When a slice adds, renames, or moves an
    engine public export, shared coordinate table, or engine-facing constant,
    update the runtime export, `types/engine.d.ts`, `docs/engine-boundary.md`,
    `docs/spec.md`, and at least one direct engine test in the same commit.
    Constant/table moves must preserve value and order with a direct shape/value
    assertion or an explicit side-by-side equivalence note. The verification
    record must state which semantics remain caller-owned, such as NEON tile
    vocabulary, mutation policy, sequential mutation order, or runtime side
    effects.
11. **False-positive evidence.** Any reviewer finding rejected as a false positive
   must be backed by a code citation, test, or runtime-order proof so the same
   concern does not get relitigated without new evidence. A critique claim based
   on repository shape or file existence must cite current-repo evidence before
   it can block or redirect work; if it lacks that evidence, treat the stale claim
   as a critique-process miss and verify it directly before acting. Any reviewer
   claim that a removed invariant, comment, symbol, or behavior is "preserved
   elsewhere" must cite the destination file and line range, and the agent must
   verify that citation before accepting the claim.
12. **Review-fix shipment proof.** Before replying that a review finding is
   addressed, verify the fix commit is present in the PR head (`headRefOid` or
   `gh pr view --json commits`) and that the changed file content is present in
   the branch or merge commit that will ship. If a PR was already merged, verify
   the target branch tree, not just the local feature branch.
13. **Failed multi-file patch recovery.** If a multi-file patch reports failure,
   assume the worktree may be partially modified. Before retrying, record
   `git status --porcelain`, inspect every touched target or the affected diff,
   and retry with smaller patches grouped by file or tightly related surface.
14. **Extension/trigger path proof.** Any extension or trigger scaffolding must
   record the resolved file path, verify it lives under the implementation
   worktree, verify whether the path is ignored, and prove the committed project
   extension is tracked. If a live user-scope extension is installed to protect
   the current session, record which extension path/scope is active after reload
   and which copy is authoritative.
15. **Pre-promotion authority/range audit.** Before opening or merging any PR
    targeting `main`, fetch `origin/main` and `origin/develop`, inspect the
   repository branch-policy workflow or status checks for allowed source
   branches, and record the exact commit range with authorship
   (`git log --format='%h %an <%ae> %s' origin/main..origin/develop` for a
   `develop` promotion). For this audit, treat any commit whose author email is
   not a known agent identity (`bropilot-cli[bot]`, `Copilot`, or another
   configured agent account) as human-authored. Record PR opener, squash/rebase
   commit author, and original PR commit authors separately; a Darin-opened PR
   can legitimately produce a Darin-authored squash commit even when the PR
   commits were agent-authored. If policy only allows this repository's
   `develop -> main`, do not open isolated feature-branch-to-main PRs. If the
   range includes human-authored commits, quote the active project or repository
   instruction that explicitly permits `develop -> main` promotion with those
   commits; a general autonomy, yolo, or feature-work instruction is not enough.
   If that authority is absent or conflicts with another active rule, stop
   instead of inferring approval. A closed PR whose source branch was changed or
   replaced should not be treated as reopenable; open a replacement PR from a
   fresh branch.
16. **Upstream overlap and docs-dedupe proof.** Before extracting a symbol or
    subsystem, check whether equivalent work has already landed upstream or in an
    open PR so the slice can shift to reinforcement instead of duplicating work.
    When editing roadmap or checklist-style docs, search for duplicate entries
    before review and again after conflict resolution.
17. **Contractual iteration-order proof.** When extracting or reimplementing
    legacy behavior where scan, traversal, RNG, tie-break, or insertion order is
    part of the contract, derive the expected order directly from the source loop
    structure before writing tests or helper JSDoc. Record the loop shape in the
    evidence (for example, "top/bottom per x, then left/right per y") and add a
    characterization test that asserts the exact output order before review.
18. **Extraction equivalence and smoke proof.** For each extracted function or
    helper, add a focused characterization/equivalence test that covers the moved
    behavior's contract, including edge cases that made the original code
    non-trivial. If one test is sufficient, say why; if no new test is added,
    record the existing test name that already covers the extracted contract. For
    dungeon-generation, render, input, or other hot-path/runtime extractions, run
    a focused smoke test that exercises the integrated caller before review or
    immediately after release if the smoke depends on shipped artifacts. For
    behavior-preserving dungeon-generation refactors, include deterministic
    seeded-output evidence before and after the change: either a before/after
    digest comparison for representative seeds/floors, or an existing checked-in
    digest test that was run both before and after. Record the exact seeds/floors
    and test names so "behavior-preserving" is backed by reproducible output,
    not only by source-motion review.
19. **Tool compatibility fallback.** Before relying on a CLI flag or output mode
    that is not already used successfully in the current session, either preflight
    the help/version output or be prepared to record the exact fallback command
    that succeeded. A tool-version mismatch is not resolved by retrying once; the
    retrospective must name the canonical compatible command shape used after the
    mismatch.
20. **Shared-branch force alignment guard.** Before force-with-lease aligning a
    shared branch after a deliberate rebase promotion, fetch the remote branch,
    record the exact old and new SHAs, prove the source and target trees match,
    and check for open PRs or unexpected commits that would be overwritten. If
    the target changed since the promotion PR was opened or contains work outside
    the just-promoted range, stop and reconcile deliberately instead of force
    pushing. The retrospective must include the command evidence that made the
    alignment safe.
21. **Pre-merge instruction conflict check.** Before merging any PR, compare the
    merge instructions that apply from the repository protocol, project
    instructions, and current operator/user directive. If they disagree on tool,
    merge method, authority, or post-merge verification, resolve the conflict
    before merging. Prefer the most mechanical repository guard (`npm run
    merge:pr -- <pr> --method squash|rebase`) over raw `gh pr merge`; if another
    instruction says to use raw `gh`, update that instruction or stop and record
    the conflict rather than choosing one silently. The retrospective must record
    which merge path was used and whether any instruction conflict was found.

## Pre-retrospective checklist

Before writing the retrospective:

1. Verify the current directory is the implementation worktree for the work item,
   not `/home/darin/projects/neon-dungeon`.
2. Record bounded worktree/location hygiene: `git worktree list --porcelain |
   sed -n '1,80p'` or a count-only equivalent, `git rev-parse --show-toplevel`,
   `git rev-parse --git-common-dir`, `git status --porcelain`, and
   `git ls-files --others --exclude-standard`.
3. Record every branch, worktree, or no-merged discovery command run during
   startup/continuity for the current session, and confirm each command bounded
   output with a count, format, explicit ref pattern, or line limit. If any
   command was unbounded or produced large output, record it as an incident and
   name the stronger guard adopted or the evidence-backed reason no stronger
   guard is available.
4. Confirm code-review subagents, if any, have returned and real findings were
   addressed or explicitly rejected.
5. Record the review-risk triage decision for every code-bearing path that
   resembles a red-risk file or subsystem. For example, `src/content/*` changes
   must say whether they are the literal red `src/content.js` file, Medium
   content-submodule work, or escalated because the specific change touches a
   red-risk domain.
6. For engine public-surface changes, record the surface checklist: export,
   direct test, type declaration, engine-boundary docs, spec entry, and
   caller-owned semantics.
7. For any `develop` force-with-lease alignment after a main rebase promotion,
   record tree-equivalence of the old `develop` tip and new `main` tip plus the
   bounded remote-ref containment result for the old tip before the push.
8. Save the final evidence for reviewers: file list, staged or committed diff,
   checks run, PR/issue links, and incidents.
9. Confirm the main checkout has no active work or untracked files related to
   the task.
10. Check the active backlog or issue queue before stopping; if work remains,
   start the next work item from a worktree after attaching the retrospective.
8. Run `npm run check:agent-continuity -- --issue <number>` for issue-backed
   work before any `task_complete`; this standard npm script requires the
   operator guard extension to be present and tracked. If it fails, keep working
   or record a concrete blocker.
   For post-release work, the same check must prove that the `develop:
   squash-only PRs` ruleset still has both its pull-request rule and the admin
   bypass needed for direct force-with-lease alignment after a rebase promotion.
9. If extension or trigger files were created, run a path/scope audit: actual
   path, `git check-ignore`, `git ls-files`, extension reload/list/inspect
   output, and primary-checkout stray-file check.
10. If the work item opens or merges a PR targeting `main`, include the
   pre-promotion authority/range audit evidence: allowed source branch, exact
   commit range, commit/PR authors, any human-authored commits by the audit
   definition above, and the quoted project or repository instruction that
   permits the promotion.
11. If resuming after a restart, a handoff gap, or a user reference to "last
    session", an issue number, or a prior finding, query session history/checkpoints
    for that reference before assuming the current shell directory is the active
    work context.
12. If `origin/main` and `origin/develop` diverged during release promotion,
    record the deliberate reconciliation evidence: likely root cause, exact
    pre-alignment SHAs, tree IDs, patch-equivalence proof, force-with-lease target
    SHA, and the post-alignment SHAs. Do not treat "trees matched" as sufficient
    without explaining why alignment was safe for open PRs and active work.
13. Before attaching the retrospective, verify every version number, PR number,
    commit SHA, branch tip, and release tag cited in the text against the source
    artifact (`gh pr view`, `gh release view`, `git rev-parse`, workflow output,
    or deployed `version.json`). If the work has both an in-spec changelog version
    and a production release version, label them explicitly so the retrospective
    cannot imply one should equal the other.

## Required inputs

Collect only facts that affect future behavior:

- original request or issue;
- branch and worktree path;
- proof that the retrospective is running from the worktree;
- files changed and PR number, if any;
- pasted final diff or commit range for reviewers;
- checks run and their outcomes;
- extraction/refactor characterization evidence: the new or existing tests that
  prove the moved behavior's contract, plus the focused integrated smoke test for
  runtime/hot-path extractions;
- test delta itemization: every new or removed test name, file, and purpose, plus
  how the focused/full test-count changes map to those tests;
- primary claim evidence: map the main success claim (for example, behavior
  preservation, runtime wiring, or policy compliance) to the specific tests,
  source citations, runtime-order proof, or post-final-rebase review that proves
  it. Pre-rebase reviews may be historical context, but they are not the
  load-bearing review evidence for the shipped tree;
- stale-resume preflight status, if the work item resumed existing branch,
  worktree, staged diff, handoff, session-history work, or any branch that had
  not fetched in the current session;
- review-risk triage: changed code-bearing paths, red-risk or ambiguous
  applicability, reviewer count required, and reviewer count actually used;
- fresh-worktree bootstrap status;
- new-runtime-file surface audit, if a runtime file was added or moved;
- classic-script runtime proof, if top-level globals moved;
- reviewed change identity: reviewed commit SHA or unstaged-diff description, plus
  merge/release tree-equivalence proof when squash or rebase promotion rewrites
  commit SHAs;
- review findings, including false positives and why they happened;
- reviewer scope summary: whether reviewers inspected the staged diff or shipped
  tree, the invariants they were asked to check, and any requested changes or
  explicit no-issue verdicts; include short reviewer-output excerpts for each
  load-bearing review instead of only summarizing "no issues";
- review-fix shipment proof: PR head/commit evidence and target-branch content
  evidence for every claim that a review finding was addressed;
- incidents, near misses, user corrections, or places where the agent wasted
  time;
- repeated incidents and the concrete guard adopted, or the evidence-backed
  reason no guard was added;
- tool/version incompatibilities encountered and the canonical fallback command
  shape used afterward;
- pre-promotion authority/range audit for PRs targeting `main`, including the
  branch policy, commit range, PR opener, squash/rebase commit author, original
  PR commit authors, any human-authored commits by the audit definition, and
  cited merge authority;
- branch-divergence reconciliation evidence when `main` and `develop` differ by
  SHA after a promotion: root cause, tree IDs, patch-equivalence proof,
  force-with-lease target, and post-alignment SHAs;
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
   merge failed or only local cleanup failed. Before any merge command, use
   `npm run merge:pr -- <pr> --method squash|rebase`; the wrapper performs the
   parsed state preflight, refuses `--delete-branch`, enforces the expected merge
   method for `develop` and `main`, checks statuses, and verifies the remote
   merge result. The operator guard extension blocks raw `gh pr merge` bash
   commands so agents must use the wrapper path. If a retrospective finds that
   this wrapper, its parsed-state guard, or the raw-merge tool block was skipped,
   the recurrence-prevention response must be mechanical (script, wrapper,
   extension hook, or CI/continuity check), not a restatement of this text.
   Successful post-merge verification is detective evidence only; it does not
   convert a skipped preventive guard into an acceptable merge path.
   If using the underlying command manually, the retrospective evidence must
   include the parsed state value or the hard-stop output:

   ```bash
   state=$(gh pr view "$pr" --json state --jq .state)
   if [ "$state" != "OPEN" ]; then
     echo "PR #$pr is $state; aborting merge"
     exit 1
   fi
   gh pr merge "$pr" --squash
   ```

   If a local worktree already has the target branch checked out, omit
   `--delete-branch` on the merge command or perform remote cleanup separately
   so expected local cleanup failures do not obscure the remote outcome.
   For release promotions, verify `origin/main == origin/develop` after any
   required post-release alignment and record whether repository rules were
   bypassed by the durable admin bypass rather than temporary rule deletion.
   If force-aligning branches after a rebase promotion, record the precondition:
   the branches are patch-equivalent and the force-with-lease protects the
   observed old target SHA.
8. **Verify pre-verification controls.** Confirm every numbered
   pre-verification control was handled where applicable, including explicit
   `not applicable` reasons for controls outside the work item's scope.
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
    A final retrospective must name the reviewers/models used and the adopted or
    rejected findings; do not attach or file a completed retrospective with this
    field left as `pending`.
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
    Before answering "no" because an existing document already covers a miss,
    quote the exact guard text and cite the file/line. If exact text cannot be
    found, the guard is absent and must be added or explicitly rejected with
    evidence.

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
- **Primary claim evidence**:
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
