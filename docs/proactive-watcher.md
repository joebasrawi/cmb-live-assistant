# Proactive Watcher

The Proactive Watcher is the layer that makes the assistant feel alive during a meeting. It listens to each final transcript segment, extracts claims and references, searches prior meeting memory, and pushes alerts without a user prompt.

## What It Catches

- Possible inconsistency: a live claim differs from a prior source-backed statement, vote, memo, or discussion.
- Prior record found: someone asks for history or says something has never come up before.
- Vote-time context: a motion or vote appears imminent and the assistant pulls related prior records.
- Source gaps: a detected agenda item or record reference has no local memory match yet.

## Alert Rules

The current local implementation is rule-assisted and source-grounded:

- It detects topics such as Ocean Drive, budget, procurement, housing, transportation, public safety, and resilience.
- It detects stances such as support, opposition, fiscal impact, no fiscal impact, procurement tie, no procurement tie, and unprecedented claims.
- It compares those stances with structured prior-meeting records in `data/memory/records.jsonl`.
- It labels alerts as possible issues and shows evidence. It does not accuse anyone of lying.

## Historical Record Schema

Each prior-meeting memory record is a JSON object:

```json
{
  "id": "official-2024-03-13-r7b-ocean-drive-001",
  "title": "Ocean Drive operating restriction discussion",
  "recordType": "statement",
  "meetingDate": "2024-03-13",
  "meetingTitle": "City Commission Meeting",
  "agendaItem": "R7B",
  "person": "Commissioner Name",
  "role": "Commissioner",
  "topic": "Ocean Drive",
  "stance": "support",
  "claim": "Supported a limited operating restriction pilot.",
  "evidence": "Short source-backed excerpt or paraphrase.",
  "sourceUrl": "https://official-source-url",
  "timestamp": "02:14:20"
}
```

## Accepted Stances

- `support`
- `oppose`
- `fiscal-impact`
- `no-fiscal-impact`
- `procurement`
- `no-procurement`
- `prior-discussion`
- `record-exists`

## Importing Records

Use JSON or JSONL:

```powershell
node scripts/import-records.js .\path\to\records.jsonl
```

The current records are demo records so the live alert behavior can be tested immediately. They must be replaced or expanded with official agenda, minutes, video timestamp, and transcript records before commissioner-facing use.

## Production Guardrails

- Every alert needs evidence.
- Use "possible inconsistency" or "prior record differs," not accusations.
- Show meeting date, agenda item, speaker or department, and source URL.
- Keep transcript and AI-generated notes separate.
- Allow staff or an admin to pin the correct source when the assistant has an uncertain match.
