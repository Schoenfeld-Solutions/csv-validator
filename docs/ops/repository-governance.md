# Repository Governance

## Main Branch Protection

The repository uses an active GitHub repository ruleset for `main`. Expected
state:

- Name: `Protect main`
- Target: `refs/heads/main`
- Enforcement: `active`
- Bypass actors: no bypass actors
- Branch deletion blocked
- Non-fast-forward updates blocked
- Pull request required before merge
- Squash merge as the allowed merge method
- Review threads must be resolved
- Linear history required
- Required status checks with strict policy:
  - `validate-pr-title`
  - `Preflight`

The current ruleset state can be read locally with:

```bash
gh ruleset view 17949627 -R Schoenfeld-Solutions/csv-validator
```

If GitHub changes the ID later, the ruleset must still keep the properties
listed above.

## Human Merge Boundary

The ruleset currently uses `required_approving_review_count: 0` because this
solo repository uses a shared human/agent workflow. This is acceptable only
while the maintainer consciously controls ready status and squash merge, unless
explicit merge handling is approved for the current task.

## Local Governance Checks

`npm run check:governance` validates the most important locally versioned
policies:

- expected workflow files, permissions, concurrency, and job timeouts,
- stable required check names for the ruleset,
- no use of `pull_request_target`,
- low-noise Dependabot for npm and GitHub Actions,
- `.local/` is included in Git and tooling ignores and is not tracked,
- `docs/plans/` is included in Git and tooling ignores and is not tracked,
- no tracked local DATEV sample or binary artifacts,
- maintained contributor documentation and PR template.

## Local Plan Documents

`docs/plans/` is an intentionally local workspace for detailed implementation
plans. These files are not part of the public repository contract and must not
be staged, committed, or pushed. When a local plan creates binding project
rules, those rules must be moved into versioned documentation or tests.

Remote GitHub rulesets are not changed from CI. Remote verification remains a
maintainer check through `gh ruleset view`.
