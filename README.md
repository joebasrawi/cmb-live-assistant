# CMB Live Assistant

A prototype live assistant for City of Miami Beach Commission meetings.

It is designed to watch a live meeting transcript, detect references like agenda items, ordinances, LTCs, contracts, and policy topics, then pull relevant source-backed notes for everyone in the room.

## What Works Now

- Local web dashboard.
- Shared live room with server-sent updates.
- Demo meeting stream.
- Manual transcript ingestion endpoint.
- Local meeting memory search over JSONL records.
- Reference detection for agenda codes and common public-record terms.
- Proactive alerts for possible inconsistencies, prior-record context, and vote-time checks.
- Dais Mode for a cleaner live commissioner view.
- Three role-based accounts: one commissioner view and two aide views.
- Aide-reviewed cards that aides can send into the commissioner live room.
- Preflight checks for model config, stream tools, indexed memory, and current agenda preload.
- Aide Review queue for draft catches before they reach the commissioner.
- Meeting Prep with current agenda sources, risk flags, and "What should I ask?" questions.
- Upcoming meeting selector covering Commission, committee, board, and land-use meetings indexed from PrimeGov.
- Dark-mode public dashboard for GitHub Pages.
- Static public archive search over a generated 2020-forward official metadata index.

## What Comes Next

- Add live audio capture from MBTV/YouTube or Zoom.
- Wire realtime transcription.
- Add OpenAI Responses API note generation with file search and custom tools.
- Add stronger production authentication, audit logs, and account management.

## Run Locally

From PowerShell:

```powershell
.\scripts\start.ps1
```

Then open:

```text
http://localhost:8788
```

If you have a normal Node.js install available, this also works:

```powershell
npm start
```

## Dashboard Accounts

The app starts with three simple accounts:

```text
commissioner / dais
aide1 / aide
aide2 / aide
```

Change them in Railway Variables or a local `.env` file:

```text
COMMISSIONER_USERNAME=
COMMISSIONER_PASSWORD=
COMMISSIONER_NAME=
AIDE1_USERNAME=
AIDE1_PASSWORD=
AIDE1_NAME=
AIDE2_USERNAME=
AIDE2_PASSWORD=
AIDE2_NAME=
```

Commissioner accounts open into a minimal dais view: Ask the Staffer, meeting prep, and aide-reviewed important cards. Aide accounts open the fuller operations view with preflight, draft alert review, source notes, transcript, and the ability to send reviewed cards to the commissioner.

Use the Meeting dropdown in the aide/full view to target a committee, board, land-use, or Commission meeting before running prep or asking item-specific questions.

## Environment Check

```powershell
node scripts/check-env.js
```

In the Codex desktop environment, use the bundled Node runtime if the regular `node` command is blocked.

## Public Demo

Phone-visible demo:

```text
https://joebasrawi.github.io/cmb-live-assistant/
```

The `public/` folder is deployable to GitHub Pages. In the public demo, the app falls back to static mode when the API is unavailable, so phone viewers can start the demo and see proactive alerts without a backend.

## Proactive Watcher

The proactive watcher compares live transcript claims against structured prior-meeting memory in:

```text
data/memory/records.jsonl
public/data/official-archive-records.jsonl
```

The current official metadata index is generated from PrimeGov and City Clerk Laserfiche/WebLink. Refresh it with:

```powershell
node scripts/ingest-official-archives.js --from-year=2020 --max-weblink-records=20000
```

Import additional hand-reviewed statement/vote records with:

```powershell
node scripts/import-records.js .\path\to\records.jsonl
```

See `docs/proactive-watcher.md` for the schema and guardrails.
See `docs/production-launch.md` for production hosting, storage, and live-meeting requirements.

## Official Source Starting Points

- City meetings and agendas: https://www.miamibeachfl.gov/city-hall/city-clerk/meetings-and-agendas/
- MBTV live/archive information: https://www.miamibeachfl.gov/mbtv/
- Archived meetings: https://www.miamibeachfl.gov/mbtv/archived-meetings/

## Shared Access

The prototype is local. For a commissioner-facing version, deploy it behind a secure host with:

- Login by email or SSO.
- Viewer roles.
- HTTPS.
- Audit logs.
- Clear labels for transcript, AI notes, confirmed sources, and uncertain matches.
