# Evidence checks and their limits

Sources checked 21 October 2026. These checks support a New Zealand document operator's review. They do not assess every legal obligation or declare a business compliant.

## Accuracy before use

[Privacy Act principle 8, Office of the Privacy Commissioner](https://www.privacy.org.nz/privacy-principles/8/) requires reasonable steps in the circumstances to ensure personal information is accurate, current, complete, relevant and not misleading before use or disclosure. The CLI requires an operator's accuracy evidence for the current data version before generating a personal-information document. It cannot establish that the evidence is true. Editing or reimporting the data clears the check.

## Retention purpose

[Privacy Act principle 9, Office of the Privacy Commissioner](https://www.privacy.org.nz/privacy-principles/9/) limits retention to what is needed for a lawful purpose. A personal-information job needs a purpose and an operator-chosen retention review date. The law does not prescribe our date or a universal retention period. The report flags missing and overdue decisions, including archived jobs. Archiving does not erase the data, review packets, exports or output snapshots. A retention decision must cover all copies, backups and imported source files. Deletion and legal holds need an explicitly designed process before real use.

## House controls

Template approval, a different reviewer label, a current template-review date, complete merge fields, draft-only generation and output hashes are house controls. They are not legal rules. Review decisions and template/output snapshots are append-only for the application role; a database owner can still change the database and is trusted. Names are labels, not authenticated identity or signatures. An approved output is a local decision, never evidence of delivery or a binding signature.

## Security and use

Only a trusted operator should access this base. Tables enable row-level security and grant nothing to the public role. The database owner bypasses those restrictions by design. Do not expose owner credentials to end users or a browser. Remote database TLS is verified. Drafts, HTML reports and backups contain business data and belong in protected storage. The local files use restrictive permissions where supported. Windows access control must be configured by the operator.

Australia and other jurisdictions need a separate rules review. Signing, e-signature evidence, tax calculations, legal advice, regulated payment execution and authenticated customer portals are outside this base.
