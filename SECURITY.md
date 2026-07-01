# Security Policy

## Supported Scope

This repository publishes a static client-side tool. The main security goals
are:

- no uploads of DATEV files,
- no storage of file contents,
- no telemetry, analytics, or tracking,
- no secrets or private artifacts in the repository,
- least-privilege GitHub Actions permissions.

## Reporting Sensitive Issues

Please report sensitive security issues privately to the repository owner
instead of opening a public issue. Describe the affected path, workflow, or
browser case, and include the smallest useful reproduction.

## Handling Rules

- Do not commit credentials, tokens, DATEV files, raw artifacts, logs, or local
  exports.
- File names and diagnostics must be rendered safely.
- DATEV file contents must not enter the UI through `innerHTML`.
- New production dependencies need a traceable justification.
- Workflow permissions stay minimal.
