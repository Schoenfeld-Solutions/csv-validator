# Contributing

This project should remain small, auditable, and statically deployable.

## Development Baseline

- Node.js `25.6.1` or compatible with `>=25`.
- npm is the package manager.
- TypeScript stays strict.
- Runtime code stays framework-light: Astro for the static site, vanilla
  TypeScript for browser interaction, and a Web Worker for file parsing.

```bash
npm ci
npm run preflight
```

## Boundaries

- No server API and no upload feature.
- No analytics, telemetry, or external fonts.
- No DATEV logos, brand assets, official ZIPs, XMLs, screenshots, EXEs, HTML
  reports, decompiled content, or raw rule strings.
- No React, Vue, Svelte, Tailwind, or UI component library dependency in the
  MVP.

## Commits And Pull Requests

- Conventional Commits are required.
- Valid form: `<type>(<scope>): <description>`.
- Examples: `feat(validator): add header checks`,
  `test(worker): cover invalid quotes`, `docs(readme): document privacy`.
- Pull requests must keep `npm run preflight` green.

## Documentation

Public contract, privacy, security, and deployment changes must be reflected in
README, NOTICE, SECURITY, or the contract documents.
