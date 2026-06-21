# Hinweise zu Attribution, Lizenz und Unabhaengigkeit

Dieses Repository wird von Schoenfeld Solutions gepflegt und stellt ein
unabhaengiges, clientseitiges Open-Source-Tool zur lokalen Strukturpruefung von
DATEV-CSV-Dateien bereit.

## Unabhaengigkeit

DATEV wird in diesem Projekt nur beschreibend verwendet. Dieses Tool ist nicht
mit DATEV eG verbunden, nicht von DATEV eG autorisiert und verwendet keine
DATEV-Logos, Markenassets, Screenshots, EXEs, ZIPs, HTML-Berichte,
dekompilierten Inhalte oder offiziellen Rohartefakte.

## Contract-Herkunft

Der lokale Struktur-Contract wurde aus dem read-only Referenzrepository
`/Users/Gabriel/Repositories/Normec/com.datev.validator` abgeleitet. In dieses
Repository werden nur normalisierte Struktur-Fakten uebernommen: Recognition-
Codes, Header-/Caption-Grenzen, Feldnamen, Feldreihenfolge, Feldtypen,
Pflichtstatus, Laengen, Dezimalstellen und die kleinen Date-Ausdruecke `TTMM`
und `TTMMJJJJ`.

Nicht uebernommen werden offizielle DATEV-ZIPs, XMLs, HTML-Berichte,
Screenshots, EXEs, dekompilierte Inhalte, Logos, Markenassets, raw Rule-
Strings oder DATEV-UI-Meldungstexte.

## Lizenz

Der Projektcode steht unter der Apache License 2.0. Der Lizenztext in
[LICENSE](LICENSE) ist verbindlich.

## Haftungsausschluss

Das Tool wird ohne Gewaehrleistung bereitgestellt. Ein erfolgreiches Ergebnis
bedeutet ausschliesslich, dass die Datei gegen den implementierten lokalen
DATEV-CSV-Strukturvertrag gueltig ist. Daraus folgt keine Garantie fuer die
Akzeptanz in DATEV-Produkten oder fuer fachliche, steuerliche oder
buchhalterische Richtigkeit.
