# CLI reference

Run node scripts/documents.mjs <command> with the arguments below. Options use --name=value. --json prints machine-readable results. Commands with names accept a case-insensitive exact name or unique ID prefix. Ambiguous matches list candidates and exit 1. Errors exit 1.

| Command | Arguments |
|---|---|
| /help | Show this usage |
| /templates | List templates and review readiness |
| /jobs | List document jobs |
| /merge-queue | List open jobs in due-date order |
| /attention | Find overdue jobs and missing evidence |
| /template-review | List template reviews needing attention |
| /workload | Compare owners and due work |
| /outputs | List generated snapshots and their decisions |
| /activity | Read change history |
| /imports | Read import receipts |
| /compliance | Check privacy evidence and house controls |
| /insights | Answer ten cross-record questions |
| /template | <name or id> Read template versions and review history |
| /job | <name or id> Read job, data and output history |
| /add-template | --name= --owner= --file=template.txt or docx --actor= |
| /revise | <template> --file= --note= --actor= |
| /approve-template | <template> --decision=approved or changes --evidence= --due=YYYY-MM-DD --actor= |
| /archive-template | <template> --actor= |
| /add | --name= --template= --owner= --due=YYYY-MM-DD --data=file.json --actor= |
| /set-data | <job> --data=file.json --actor= |
| /assign | <job> --owner= --due=YYYY-MM-DD --actor= |
| /classify | <job> --privacy=personal or business --purpose= --retention=YYYY-MM-DD --actor= |
| /check-accuracy | <job> --evidence= --actor= |
| /validate | <job> Show merge fields and all generation blockers |
| /generate | <job> --actor= Save a new draft output snapshot |
| /review-output | <output-id> --decision=approved or changes --evidence= --actor= |
| /render-output | <output-id> Render the saved HTML snapshot again |
| /archive | <job> --actor= Archive without deleting history |
| /import | conga <workbook.xlsx> --master=Master --template=<name or id> --key=source-id --name= --owner= --due=YYYY-MM-DD --actor= [--dry-run] |
| /export | [--out=exports/backup.json] Export all records |
| /draft-review | <job> Write a local review packet |
| /weekly-review | Draft Monday review from queue, attention and compliance |

## A complete document run

```bash
node scripts/documents.mjs add-template --name="Service confirmation" --owner="Office manager" --file=examples/service.txt --actor="Editor"
node scripts/documents.mjs approve-template "Service confirmation" --decision=approved --evidence="Wording and fields checked" --due=2027-10-21 --actor="Reviewer"
node scripts/documents.mjs add --name="Example confirmation" --template="Service confirmation" --owner="Office manager" --due=2026-11-01 --data=examples/job.json --actor="Operator"
node scripts/documents.mjs classify "Example confirmation" --privacy=personal --purpose="Confirm requested work" --retention=2027-01-21 --actor="Operator"
node scripts/documents.mjs check-accuracy "Example confirmation" --evidence="Compared with the approved brief" --actor="Operator"
node scripts/documents.mjs validate "Example confirmation"
node scripts/documents.mjs generate "Example confirmation" --actor="Operator"
```

Use actual dates, people and evidence. Review the returned output ID with review-output. The generator and reviewer labels must differ. Reusing a label is not proof of identity. For batches, list merge-queue, validate every intended job, and generate each ready job. Every job gets a separate output and decision. No background worker sends files.

export writes every business record and saved HTML snapshot to a new JSON file. It refuses to overwrite an existing file. Use native database backups for recovery and test a restore separately.
