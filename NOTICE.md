# Attribution, License, And Independence Notice

This repository is maintained by Schoenfeld Solutions and provides an
independent client-side open-source tool for local structural validation of
DATEV CSV files.

## Independence

DATEV is used descriptively in this project. This tool is not affiliated with
DATEV eG, is not authorized by DATEV eG, and does not use DATEV logos, brand
assets, screenshots, EXEs, ZIPs, HTML reports, decompiled content, or official
raw artifacts.

## Contract Origin

The local structural contract is a project-owned derived contract. This
repository only contains normalized structural facts needed by the browser
validator: recognition codes, header and caption boundaries, field names, field
order, field types, required status, lengths, decimal places, and the small
date expressions `TTMM` and `TTMMJJJJ`.

The repository does not include official DATEV ZIPs, XMLs, HTML reports,
screenshots, EXEs, decompiled content, logos, brand assets, raw rule strings,
or DATEV UI message text.

## License

The project code is licensed under the Apache License 2.0. The license text in
[LICENSE](LICENSE) is authoritative.

## Disclaimer

The tool is provided without warranty. A successful result means only that the
file is valid against the implemented local DATEV CSV structural contract. It
does not guarantee acceptance by DATEV products or subject-matter, tax, or
accounting correctness.
