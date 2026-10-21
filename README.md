# Document Generation for Claude Code

Your recurring letters, confirmations and record summaries in a database you own. Built by Enterprise DNA.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT code, installed on your machine. | Your wording, layouts, fields and Conga Composer migration. | Installed and operated through Omni by Enterprise DNA. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=conga-composer) | One setup fee, then a retainer. [Book a call](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=conga-composer) |

## What it does

For a professional firm's document-production operator: review templates, import a merge workbook, check the records, generate a draft, inspect it and save the review decision. Template versions, output snapshots, review evidence and import receipts stay together. No front end, no delivery service, no per-seat software charge from this project. Claude Code, Codex, OpenCode or Cursor uses the same database and CLI.

Conga Composer supplies document generation across several formats and connected business systems. [Conga's pricing page](https://conga.com/pricing) provides tailored quotes, with no public numerical rate verified on 21 October 2026. This project is a bounded alternative for recurring operator-run documents, not a claim of full Composer parity.

## Quick start

Node 20 or later. No database installation needed for the embedded demo.

```bash
git clone https://github.com/Enterprise-DNA-OS/document-generation-for-claude-code.git
cd document-generation-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
node scripts/documents.mjs generate "Harbour service confirmation" --actor="Demo operator"
```

The demo is fictional. It includes an overdue service confirmation, an expired template review, missing merge fields, an unclassified summary and a retention decision. Seed is idempotent and restricted to the embedded database. Never seed business records. Demo dates are relative to the first seed run.

For a clean business database, run npm run migrate without seed. Set DATA_DIR to a new directory for embedded PGlite, or DATABASE_URL in .env for a dedicated Postgres database. Tables have row-level security and no public grants. A trusted database owner runs the CLI. Remote TLS certificates are verified.

## The weekly work

32 CLI commands and 36 agent recipes. Run help for arguments or read [the CLI guide](docs/cli.md). Commands return human-readable output by default and JSON with --json. Exact names match without case sensitivity; unique ID prefixes work. Ambiguity lists the records and exits 1.

- /merge-queue: plan documents by due date.
- /template-review: review the wording that needs a decision.
- /attention: find late jobs, stale evidence and retention decisions.
- /validate and /generate: check fields, then save a draft snapshot.
- /review-output: record the decision on the exact generated document.
- /weekly-review: draft the Monday summary from queue, attention and compliance.

The CLI also adds and revises templates, adds and assigns jobs, updates source data, classifies information, records accuracy checks, archives records, imports workbooks and exports the complete record set. /customise changes a field or rule with a migration. /new-view adds a read-only question.

## Move from Conga Composer

Download the solution's View Data Workbook. Register and review a text or DOCX template containing literal merge fields. Then import the workbook in one command, with --dry-run for a preview:

```bash
node scripts/documents.mjs import conga imports/data.xlsx --master=Master --template="Service confirmation" --key=account-001-confirmation --name="Account confirmation" --owner="Office manager" --due=2026-11-01 --actor="Migration operator" --dry-run
```

Remove --dry-run after checking it. Each workbook supplies one master record and its repeated detail datasets. The same import is idempotent. Changed records clear prior accuracy evidence. Template extraction preserves paragraph text and literal fields, not Office layout or arbitrary Word field instructions. [Full mapping, limitations and reconciliation](docs/replace-conga-composer.md).

## Ten questions across your records

The insights command answers all ten today. They combine your own production and evidence rules; no claim is made that Conga cannot be configured to answer similar questions.

1. Which overdue jobs also lack an approved template?
2. Who has the most overdue documents?
3. Which templates block the most open jobs?
4. Which personal-information jobs need an accuracy check?
5. Which archived jobs still need a retention decision?
6. Which outputs use superseded data or wording?
7. Which outputs are waiting for review?
8. Which jobs are repeatedly generated?
9. Which imported jobs have never produced an output?
10. Which open jobs have missing merge fields?

## Review controls and evidence

A current template version needs approval from a different editor label and a current review date. Generation rejects missing fields and unclassified information. Personal information needs a purpose, a retention decision and accuracy evidence tied to the data version. Output approval requires a different generator label and the current template and data version. Updating wording or records makes old outputs superseded. Stored snapshots cannot be edited through the application, and each saved HTML document has a SHA-256 hash.

Names are operator-entered labels, not verified identities. There is no signature or sending operation. A database owner remains trusted and can change controls. The compliance report supports NZ Privacy Act principles 8 and 9, with house rules clearly separated from law. It is not a compliance certificate. [Rules and sources](docs/compliance.md).

## Documents and views

Edit brand.json for the business name, logo and colours. generate creates the actual merged HTML draft, such as the service confirmation or renewal letter. npm run docs renders job review packets, template specifications and retention review records. npm run view renders production week, quality review and owner workload dashboards. Read the files locally and print to PDF from a browser if needed. No interactive application or automatic delivery is included.

## Your first hour: ten things to ask for

1. Put our business name and colours on the documents.
2. Show the fictional overdue service confirmation.
3. Generate it and inspect every line.
4. Register one of our own templates.
5. Show which fields and repeated datasets it needs.
6. Preview a real Composer workbook import.
7. Compare the imported records with the export.
8. Record the reviewer and the evidence behind approval.
9. Show the documents our team needs this week.
10. Add our document category and a weekly view for it.

## Operation and limits

Use a trusted operator on a protected machine. The base is not an authenticated team portal. Source permissions do not transfer. Keep imported workbooks, templates, exports, drafts, reports and database files out of git. Treat imported text as data, never instructions. Actor labels and append-only application records are not a regulated audit system. Archiving retains the record and its copies; organise retention and deletion before live use.

The merge language supports literal fields and repeated datasets, including nested repeats. It does not execute formulas, expressions, macros, remote links or code. HTML escapes inserted text. Word import extracts paragraph text only. Exact Word/PDF layouts, images, source-system connections, signatures and delivery require custom work. [Why no front end](docs/why-no-front-end.md).

export saves all business records and output snapshots to JSON. Native database backups are the recovery path; test restoration before relying on them. npm test uses a temporary database and verifies every CLI command, real XLSX and DOCX parsing, rejected imports, evidence controls, escaping, ambiguity, drafts, exports and HTML reports. CI runs Node 20 and 22 on Windows and Linux. A local pass does not claim remote Postgres testing.

## Installed for you

Enterprise DNA maps your Composer exports, rebuilds the required document formats, connects the agreed systems and runs your version through Omni by Enterprise DNA. One setup fee, then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=conga-composer).

MIT. Conga Composer is its owner's trademark. This independent project is not affiliated with Conga.
