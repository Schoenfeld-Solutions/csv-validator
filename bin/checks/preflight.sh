#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "==> Preflight (canonical local quality gate)"

echo
echo "==> Lockfile"
if [[ ! -f package-lock.json ]]; then
  echo "ERROR: package-lock.json is required." >&2
  exit 1
fi

echo
echo "==> Dependency audit"
npm run audit:ci

echo
echo "==> Repository governance"
npm run check:governance

echo
echo "==> Format check"
npm run format:check

echo
echo "==> ESLint"
npm run lint

echo
echo "==> Typecheck"
npm run typecheck

echo
echo "==> Unit tests with coverage"
npm run test:coverage

echo
echo "==> Build"
npm run build

echo
echo "==> Public copy check"
npm run check:public-copy

echo
echo "==> Browser smoke"
npm run test:e2e

echo
echo "==> Lighthouse"
npm run test:lighthouse

echo
echo "✅ Preflight OK"
