# Repository Working Rules

## Scope And Precedence

- These rules apply to the entire repository.
- If nested `AGENTS.md` or `AGENTS.override.md` files are added later, the
  closest rules apply to their subtree.
- This repository is a public GitHub Pages tool. Changes should stay small,
  verifiable, and free of server or upload assumptions.

## Project Map

- `README.md`: product goal, scope, privacy baseline, and development baseline.
- `docs/contracts/`: public result and validator contracts.
- `docs/ops/`: maintainer, release, and governance runbooks.
- `src/lib/datev/`: DATEV CSV lexing, encoding, contracts, and validation.
- `src/components/`, `src/scripts/`, `src/workers/`: UI, browser interaction,
  and the worker boundary.
- `tests/unit/` and `tests/e2e/`: behavior tests for core logic and browser
  flows.
- `.github/`: CI, Pages deployment, Dependabot, and PR conventions.
- `.local/`: ignored local-only artifacts such as DATEV sample files, reports,
  and one-off test runners.
- `docs/plans/`: ignored local-only planning artifacts for upcoming slices;
  these files are not versioned remotely.

## Setup And Checks

- Node.js `25.6.1` is the validated baseline; `package.json` allows compatible
  Node 25+ versions.
- Install dependencies with `npm ci`.
- Fast check after small documentation or tooling changes:
  `npm run check:governance`, `npm run format:check`, `git diff --check`.
- Canonical gate before commit, push, or PR update: `npm run preflight`.
- Browser E2E tests run headless by default. Headful Playwright is reserved for
  intentional local diagnostics or sample-file runs that should be observed.

## Git And Pull Requests

- `main` is protected and must not be pushed to directly.
- Normal work uses short-lived `dev/<topic>` branches and pull requests.
- Commits and PR titles follow Conventional Commits:
  `<type>(<scope>): <description>` or `<type>: <description>`.
- Human Merge boundary: the agent may prepare branches, commits, and draft PRs.
  Review, ready status, and squash merge are maintainer decisions unless the
  maintainer explicitly approves merge handling for the current task.
- After a merge, delete the remote feature branch, fast-forward local `main`,
  and remove the local feature branch.

## Security And Privacy

- Do not add a server API, upload feature, telemetry, analytics, tracking, or
  external fonts.
- DATEV file contents are untrusted input. Do not render raw values through
  `innerHTML`, and do not display local absolute paths.
- Do not commit official DATEV ZIPs, XMLs, HTML reports, screenshots, EXEs,
  sample files, decompiled content, raw rule strings, or brand assets.
- New production dependencies need a documented reason and explicit approval.
- GitHub Actions permissions remain least-privilege; avoid secret-dependent PR
  gates unless there is a documented security reason.

## Architecture Boundaries

- Domain logic stays in `src/lib/datev/` and remains framework-independent and
  testable.
- UI and DOM access stay in Astro components and `src/scripts/`.
- File reading and validation run through the Web Worker so the UI remains
  responsive for larger files.
- Avoid monolithic feature slices. Contract, core, UI, tooling, and
  documentation changes should only be combined when they are necessary for one
  verifiable goal.

## Artifacts

- `dist/`, `.astro/`, `coverage/`, Playwright reports, test results, logs,
  `.env*`, `.local/`, and `docs/plans/` stay untracked.
- Local DATEV sample runs may report metadata, hashes, statuses, and diagnostic
  codes, but must not place CSV raw data in Git.
- Local planning documents under `docs/plans/` may describe goals, scope, and
  deliverables, but must not contain official DATEV raw artifacts, local
  absolute paths, or confidential data.
