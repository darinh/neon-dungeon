# Agent Retrospective Checklist

Retrospectives exist to change behavior. Run one per milestone, not per PR.

## When

- After each milestone: a `develop` -> `main` promotion, or the end of a planned
  program phase.
- Not for single PRs, commits, CI waits, or edits to this checklist.

## Standing rules

Each rule is here because skipping it caused a real incident.

1. Work only in a git worktree. The primary checkout is read-only and can lag
   `develop` by months. Read the worktree's `AGENTS.md` and this file before the
   first edit, because they bind over any copy loaded into the session.
2. In a fresh worktree, run `npm ci` before any verification command.
3. Before resuming work that predates the session (a branch, worktree,
   handoff, or backlog item), fetch `origin` and search open and merged PRs for
   the same issue, symbols, and file paths. Work can land under another path,
   so match on symbols and behavior, not titles. If equivalent work already
   landed, stop and record the evidence.
4. Before filing an issue from an audit or a generated backlog, check
   `origin/develop` for an existing implementation and tests. File only real
   gaps, with the negative evidence in the issue body.
5. Bound discovery output. Never print raw `git branch --no-merged` or
   `git worktree list`; count them or limit the lines.
   `npm run check:agent-startup` prints a bounded summary.
6. Run one test file with `node --test tests/<file>.test.js`.
   `npm test -- <file>` still runs the whole suite.
7. Stage the diff before review. Reviewers read `git diff --staged` only and never
   run mutating git.
8. Scale reviewers to risk, as the table in `AGENTS.md` "Code review policy" says.
9. A new runtime file must be registered in `index.html`, `scripts/manifest.js`,
   and the `sw.js` precache. List the globals it reads when the script first
   evaluates, and confirm a script that loads earlier defines each one.
10. Before the first full gate after moving a symbol, search tests, docs,
    `types/*.d.ts`, and runtime files for its old name and path.
11. Extractions need a direct test of each extracted helper, edge cases
    included, and a behavioral test on the caller's path. When scan,
    traversal, RNG, or tie-break order is part of the contract, pin that order
    with a characterization test before the move.
12. A universal claim ("never overlaps", "always restores") needs a test that
    enumerates the claim's domain, uses fixtures from the runtime predicate, and
    fails when a named state is never exercised. If two review rounds falsify
    the same claim, stop reviewing. Extend that test first.
13. Treat reviewer findings as leads. Check the cited file and line before
    acting on a finding or dismissing it.
14. Before calling a review finding fixed, confirm the fix commit is in the PR
    head (`gh pr view <pr> --json headRefOid,commits`).
15. On a failed CI check, read the job log and classify the failure (runner,
    dependency, product) before changing anything.
16. If a guard extension stops loading, record which protections were lost and
    the manual substitute used for each.
17. If the machine-local git wrapper blocks a mutation in a linked worktree,
    confirm that `git rev-parse --git-dir` prints `.git/worktrees/<name>` before
    using `/usr/bin/git`. Never replace a guarded npm script with raw git.

## Merge and release gates

- Merge with `npm run merge:pr -- <pr> --method squash|rebase`, never with raw
  `gh pr merge`.
- Before opening a `develop` -> `main` PR, run
  `npm run check:promotion-audit -- --allow-human-authored --authority "<quoted instruction>"`.
  Merge it with the same text in `--promotion-authority`.
- `release-version.yml` computes the release bump from the promoted head
  commit's message: a `!:` subject or a `BREAKING CHANGE:` line gives a major
  bump, a `feat:` subject a minor bump, anything else a patch. Land work so
  that the head commit carries the bump the whole range needs.
- After a rebase promotion, run `npm run align:develop`. If the local wrapper
  blocks its push, re-run it with system git first on `PATH`.
- Verify the release tag, the Pages `version.json` (`version`, `tag`,
  `commit`), and a live smoke test of the site.
- For issue-backed work, the promotion PR carries the closing keywords, and
  `npm run check:agent-continuity -- --issue <number>` exits 0.

## The retrospective

Write it from evidence:

- **Outcome.** PRs, merge SHAs, release tag, and deploy verification.
- **Request map.** Each part of the request and the artifact that answers it,
  plus its limits. Shipping evidence does not count as evaluation evidence.
- **Failures.** What went wrong, what caught it, and what would have caught it
  sooner.
- **Verification.** The test, oracle, or screenshot behind each claim, and what
  remains unverified.
- **Guards.** Rules adopted or rejected, each with its reason.

Two reviewers from different model families critique the draft from pasted
evidence only. They get no repository access, run no git, and write nothing.
Record which findings you adopted and which you rejected. Then ask whether this
checklist should change, and make any edit in the same milestone. Attach the
retrospective to the promotion PR, or to the phase's final PR when the phase
ends without a promotion.
