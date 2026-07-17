# Contributing

This project should remain small, auditable, and statically deployable.

## Development Baseline

- Node.js `26.5.0` or another compatible Node 26 release matching
  `>=26.0.0 <27`.
- npm `11.9.0` or compatible with `>=11` is the package manager.
- TypeScript stays strict.
- Runtime code stays framework-light: Astro for the static site, vanilla
  TypeScript for browser interaction, and a Web Worker for file parsing.

```bash
npm ci
npm run preflight
```

Use the package scripts for Astro commands. They set
`ASTRO_TELEMETRY_DISABLED=1` through the cross-platform project wrapper; direct
ad-hoc Astro CLI calls remain outside this repository guarantee.

## Boundaries

- No server API and no upload feature.
- No analytics, telemetry, or external fonts.
- No DATEV logos, brand assets, official ZIPs, XMLs, screenshots, EXEs, HTML
  reports, decompiled content, or raw rule strings.
- No React, Vue, Svelte, Tailwind, or UI component library dependency in the
  browser tool.

## Commits And Pull Requests

- Conventional Commits are required.
- Valid form: `<type>(<scope>): <description>`.
- Examples: `feat(validator): add header checks`,
  `test(worker): cover invalid quotes`, `docs(readme): document privacy`.
- Pull requests must keep `npm run preflight` green.

## Documentation

Public contract, privacy, security, and deployment changes must be reflected in
README, NOTICE, SECURITY, or the contract documents.
