# Repository Governance

## Main-Branch-Schutz

Das Repository verwendet ein aktives GitHub Repository Ruleset fuer `main`.
Erwarteter Stand:

- Name: `Protect main`
- Target: `refs/heads/main`
- Enforcement: `active`
- Bypass actors: keine bypass actors
- Branch deletion blockiert
- Non-fast-forward updates blockiert
- Pull Request vor Merge erforderlich
- Squash-Merge als erlaubte Merge-Methode
- Review-Threads muessen geloest sein
- Lineare Historie erforderlich
- Required status checks mit strict policy:
  - `validate-pr-title`
  - `Preflight`

Der aktuelle Ruleset-Stand kann lokal gelesen werden mit:

```bash
gh ruleset view 17949627 -R Schoenfeld-Solutions/csv-validator
```

Wenn die ID spaeter durch GitHub-Aenderungen abweicht, muss der Ruleset trotzdem
die oben genannten Eigenschaften behalten.

## Human-Merge-Grenze

Das Ruleset verlangt aktuell `required_approving_review_count: 0`, weil dieses
Solo-Repository mit einem geteilten menschlichen/Agent-Arbeitsfluss arbeitet.
Das ist nur akzeptabel, solange der Agent keine PRs merged und der menschliche
Maintainer den Ready-Status und Squash-Merge bewusst ausloest.

## Lokale Governance-Checks

`npm run check:governance` prueft die wichtigsten lokal versionierten Policies:

- erwartete Workflow-Dateien, Permissions, Concurrency und Job-Timeouts,
- stabile required check Namen fuer das Ruleset,
- keine Verwendung von `pull_request_target`,
- low-noise Dependabot fuer npm und GitHub Actions,
- `.local/` ist in Git- und Tooling-Ignores enthalten und nicht getrackt,
- `docs/plans/` ist in Git- und Tooling-Ignores enthalten und nicht getrackt,
- keine getrackten lokalen DATEV-Muster- oder Binaerartefakte,
- vorhandene Maintainer-Dokumentation und PR-Template.

## Lokale Plandokumente

`docs/plans/` ist ein bewusst lokaler Arbeitsbereich fuer ausformulierte
Implementierungsplaene. Diese Dateien sind nicht Teil des oeffentlichen
Repository-Contracts und duerfen nicht gestaged, committed oder gepusht werden.
Wenn aus einem lokalen Plan verbindliche Projektregeln entstehen, muessen die
entsprechenden Regeln in versionierte Dokumentation oder Tests ueberfuehrt
werden.

Remote-GitHub-Rulesets werden aus CI nicht veraendert. Die Remote-Verifikation
bleibt ein Maintainer-Check ueber `gh ruleset view`.
