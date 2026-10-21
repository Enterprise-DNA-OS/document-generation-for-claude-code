# Move a document workflow from Conga Composer

This base replaces a bounded operator-run document workflow. It imports a Composer data workbook, then produces reviewed HTML drafts from literal template text. It does not reproduce all Composer features.

## Take the actual export

In Composer for Salesforce, use Tools & Settings, then View Data. Conga documents this as an Excel workbook containing the solution's retrieved data: [View Data Workbook](https://documentation.conga.com/en/composer-for-salesforce/current/composer-for-administrators/composer-troubleshooting-help/composer-troubleshooting-tips), checked 21 October 2026. Save it as .xlsx. If it is legacy .xls, convert it locally to .xlsx and compare the rows first. Keep the original privately.

Download your template from its record. For Composer on Advantage, [Conga Drive](https://documentation.conga.com/en/composer-for-advantage-platform/current/conga-composer-implementation-guide/conga-drive-configuration) documents downloading templates. The two products have different screens. Do not assume a Drive metadata CSV contains the merge data.

## Prepare the template once

add-template accepts .txt or .docx. Word import extracts paragraph text only. It joins split text runs, so literal tokens survive. Use {{ACCOUNT_NAME}} and {{TableStart:SERVICES}}...{{TableEnd:SERVICES}}. These literal field and repeat forms follow Conga's [documented syntax](https://documentation.conga.com/en/composer-for-salesforce/current/composer-for-administrators/creating-composer-templates/word-templates/detail-data-in-word/repeating-data-in-word---tablestart-and-tableend).

Traditional Word MERGEFIELD instructions, conditional expressions, formulas, formatting switches, images, page layout, headers, footers, nested Word table structure, PDF forms, Excel and PowerPoint templates need explicit conversion. Word extraction does not preserve these. The importer does not promise to detect every lost Word feature. Compare the source and extracted text before template approval. Convert unsupported field instructions to literal tokens, then register and review the template using add-template and approve-template.

## Import one exported solution run

Each workbook represents one master document and its detail datasets. Inspect worksheet names. Use the exact master sheet name; the example is Master. Its first row is the column header and exactly one nonempty data row follows. Other sheets become repeated datasets named after the sheet. Every nonempty sheet needs a unique header row. Field matching ignores case, but ambiguous headers, dataset-name collisions and formulas reject the import. Empty repeated datasets are allowed; mandatory business line counts belong in your customised rule.

```bash
node scripts/documents.mjs import conga imports/data.xlsx --master=Master --template="Service confirmation" --key=account-001-confirmation --name="Account confirmation" --owner="Office manager" --due=2026-11-01 --actor="Migration operator" --dry-run
node scripts/documents.mjs import conga imports/data.xlsx --master=Master --template="Service confirmation" --key=account-001-confirmation --name="Account confirmation" --owner="Office manager" --due=2026-11-01 --actor="Migration operator"
```

The same source key and unchanged input are idempotent. Changed input updates that job, records the import receipt, invalidates accuracy evidence and requires classification again. If local data changed since an identical import, the command stops for reconciliation. Imports are transactional. Invalid input writes nothing. An archived job cannot be overwritten by import.

Workbook headers and cell values are preserved as data. Dates become calendar dates, numbers remain numbers, formatted currency strings are not invented, and leading zeros survive only when the source stores text. Column names are literal keys, including dots. Worksheet metadata, hidden worksheet state, formulas, cell styling, linked source connections and source permissions do not become access controls.

## Prove the move

Compare master fields, detail counts, identifiers, dates and displayed amounts against the exported workbook. Classify information and record accuracy evidence from that comparison. Run validate, then generate. Inspect the resulting draft beside a known Composer output. Review the precise saved output ID. Keep both workflows until the operator has checked every required document type.

The free base writes branded HTML, suitable for browser print to PDF. Word/PDF layout fidelity, Salesforce queries and permissions, live connections, mass delivery, e-signatures and automatic attachment storage are separate migration work. Enterprise DNA builds and runs those agreed requirements through Omni by Enterprise DNA. No email leaves this repo.

To try the import with fictional data, run node scripts/make-example.mjs and import imports/example.xlsx using the demo Service confirmation template.
