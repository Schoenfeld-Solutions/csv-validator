# Release Readiness

This checklist is the normal merge and release gate for the public GitHub
Pages tool.

## Local Gates

Before every PR update and before every merge:

```bash
npm run preflight
git diff --check
git ls-files .local
```

`git ls-files .local` must stay empty.

## Pull Request Gates

Pull requests targeting `main` must keep the GitHub checks `validate-pr-title`
and `Preflight` green. `dependency-review` runs as an additional supply-chain
signal.

The PR title must follow Conventional Commits. The expected merge is a squash
merge with a valid Conventional Commit subject.

## Merge Flow

1. Start from synced `main` and use a short `dev/<topic>` branch.
2. Create one focused commit or a small set of traceable commits.
3. Open a pull request with summary, scope, validation, security/risk, and
   rollback notes.
4. Wait until all required checks are green.
5. The maintainer moves the PR out of draft, reviews it, and performs the
   squash merge unless explicit merge handling is approved for the current
   task.
6. Delete the remote feature branch.
7. Switch back to local `main`, pull with fast-forward only, and delete the
   local feature branch.
8. `git status --short --branch` must show a clean `main`.

## GitHub Pages

Pushes to `main` build and publish the static Astro site through the Pages
workflow. The workflow runs the same `npm run preflight` gate before packaging
and deployment.

## Rollback

- Code, documentation, or workflow regressions are reverted through a revert PR
  against `main`.
- For Pages issues, the last green merged `main` commit is the known good
  source.
- Local sample files, reports, and build artifacts must not be committed as
  rollback artifacts.
