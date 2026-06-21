# Release Readiness

Diese Checkliste ist der normale Merge- und Release-Gate fuer das oeffentliche
GitHub-Pages-Tool.

## Lokale Gates

Vor jedem PR-Update und vor jedem Merge:

```bash
npm run preflight
git diff --check
git ls-files .local
```

`git ls-files .local` muss leer bleiben.

## Pull-Request-Gates

PRs gegen `main` muessen die GitHub-Checks `validate-pr-title` und `Preflight`
gruen halten. `dependency-review` laeuft als zusaetzliches Supply-Chain-Signal.

Der PR-Titel muss Conventional Commits folgen. Der erwartete Merge ist ein
Squash-Merge mit einem gueltigen Conventional-Commit-Subject.

## Merge-Flow

1. Von synchronem `main` eine kurze `dev/<topic>`-Branch verwenden.
2. Einen fokussierten Commit oder wenige nachvollziehbare Commits erstellen.
3. Einen Pull Request mit Summary, Scope, Validation, Security/Risk und
   Rollback-Hinweis oeffnen.
4. Warten, bis alle required checks gruen sind.
5. Der menschliche Maintainer nimmt den PR aus Draft, prueft ihn und fuehrt den
   Squash-Merge aus.
6. Remote-Feature-Branch loeschen.
7. Lokal auf `main` wechseln, Fast-Forward pullen und den lokalen Feature-
   Branch loeschen.
8. `git status --short --branch` muss einen sauberen `main` zeigen.

## GitHub Pages

Pushes auf `main` bauen und veroeffentlichen die statische Astro-Seite ueber den
Pages-Workflow. Der Workflow fuehrt vor Packaging und Deployment den gleichen
`npm run preflight`-Gate aus.

## Rollback

- Code-, Doku- oder Workflow-Regressions werden per Revert-PR gegen `main`
  zurueckgenommen.
- Bei Pages-Problemen ist der letzte gruen gemergte `main`-Commit die
  bekannte gute Quelle.
- Lokale Musterdateien, Reports und Build-Artefakte duerfen nicht als Rollback-
  Artefakte committed werden.
