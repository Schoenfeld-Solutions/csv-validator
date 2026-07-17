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
  - `dependency-review`
  - `Preflight`

The current ruleset state can be read locally with:

```bash
gh ruleset view 17949627 -R Schoenfeld-Solutions/csv-validator
```

If GitHub changes the ID later, the ruleset must still keep the properties
listed above.

## Repository Security Baseline

Expected remote state:

- Dependency Graph and Dependabot Alerts are enabled because the required
  `dependency-review` check depends on them.
- Dependabot Security Updates are enabled and not paused.
- Private Vulnerability Reporting is enabled and linked from `SECURITY.md`.
- Secret Scanning and Push Protection are enabled.
- CodeQL default setup analyzes `actions` and `javascript-typescript` with the
  default query suite and remote threat model. CodeQL remains advisory until a
  separate policy change makes it required.
- Repository metadata enables automatic deletion of merged branches and allows
  only squash merge. Merge commits and rebase merges are disabled.

Read-only verification:

```bash
gh api repos/Schoenfeld-Solutions/csv-validator/vulnerability-alerts --silent
gh api repos/Schoenfeld-Solutions/csv-validator/automated-security-fixes
gh api repos/Schoenfeld-Solutions/csv-validator/private-vulnerability-reporting
gh api repos/Schoenfeld-Solutions/csv-validator --jq '{delete_branch_on_merge,allow_squash_merge,allow_merge_commit,allow_rebase_merge,security_and_analysis}'
gh api repos/Schoenfeld-Solutions/csv-validator/code-scanning/default-setup
```

Security settings are changed one at a time and verified immediately. To roll
back a control, record the reason first and use its inverse repository endpoint.
Dependency Graph and Alerts must not be disabled while `dependency-review` is a
required check; remove that requirement through a reviewed recovery change
before disabling the prerequisite.

```bash
gh api --method DELETE repos/Schoenfeld-Solutions/csv-validator/automated-security-fixes
gh api --method DELETE repos/Schoenfeld-Solutions/csv-validator/private-vulnerability-reporting
gh api --method PATCH repos/Schoenfeld-Solutions/csv-validator --field 'security_and_analysis[secret_scanning_push_protection][status]=disabled'
gh api --method PATCH repos/Schoenfeld-Solutions/csv-validator --field 'security_and_analysis[secret_scanning][status]=disabled'
gh api --method PATCH repos/Schoenfeld-Solutions/csv-validator/code-scanning/default-setup --field state=not-configured
```

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
- fail-closed dependency review at low severity across runtime, development,
  and unknown scopes,
- documented remote security controls, read-only verification, and rollback
  boundaries,
- canonical preflight coverage, including public copy and legacy source naming
  checks,
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
