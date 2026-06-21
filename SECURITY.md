# Security Policy

## Unterstuetzter Scope

Dieses Repository veroeffentlicht ein statisches, clientseitiges Tool. Die
wichtigsten Sicherheitsziele sind:

- keine Uploads von DATEV-Dateien,
- keine Speicherung von Dateiinhalten,
- keine Telemetrie, Analytics oder Tracking,
- keine Secrets oder privaten Artefakte im Repository,
- least-privilege GitHub-Actions-Rechte.

## Meldung sensibler Probleme

Bitte melden Sie sensible Sicherheitsprobleme privat an den Repository-Owner,
statt ein oeffentliches Issue zu erstellen. Beschreiben Sie den betroffenen
Pfad, Workflow oder Browser-Fall und fuegen Sie die kleinste sinnvolle
Reproduktion hinzu.

## Handling-Regeln

- Keine Credentials, Tokens, DATEV-Dateien, Rohartefakte, Logs oder lokalen
  Exporte committen.
- Dateinamen und Diagnostics muessen sicher gerendert werden.
- DATEV-Dateiinhalte duerfen nicht ueber `innerHTML` in die UI gelangen.
- Neue Production-Dependencies brauchen eine nachvollziehbare Begruendung.
- Workflow-Permissions bleiben minimal.
