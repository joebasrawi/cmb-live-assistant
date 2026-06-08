# Build Roadmap

## Phase 1: Local Live Room

Status: working MVP.

- Run a web dashboard locally.
- Stream transcript lines into a shared room.
- Detect agenda items, ordinances, resolutions, LTCs, contracts, budget, procurement, transportation, housing, and other topic mentions.
- Search local meeting memory.
- Push notes and source cards to every connected viewer.
- Push proactive alerts when live claims differ from structured prior-meeting memory.
- Provide Dais Mode for a cleaner commissioner-facing live view.

## Phase 2: Historical Memory Since 2023

- Crawl official City of Miami Beach meeting pages.
- Download agendas, minutes, after-action reports, agenda packets, and attachments.
- Index meeting videos and timestamps.
- Transcribe missing video/audio.
- Store records with meeting date, item number, title, sponsor, department, action, vote, speakers, source URL, and document text.
- Extract structured claims, stances, vote history, fiscal-impact notes, procurement paths, and prior-discussion markers into `data/memory/records.jsonl`.
- Add semantic search using OpenAI vector stores or a local vector database.

## Phase 3: Live Watcher

- Resolve the active MBTV/YouTube stream.
- Capture audio server-side.
- Convert audio to realtime transcription format.
- Stream transcript deltas into the live room.
- Detect references continuously.
- Pull current agenda context first, then historical context.
- Generate short notes with links and confidence labels.

## Phase 4: Commissioner-Ready Access

- Deploy with HTTPS.
- Add login, roles, and audit logs.
- Add private commissioner/staff notes separate from public meeting facts.
- Add source pinning so staff can correct the assistant during the meeting.
- Add exportable post-meeting summaries, action items, and follow-up questions.

## Phase 5: Always-On Operations

- Monitor official meeting calendar.
- Auto-create rooms before meetings.
- Preload the agenda packet and supplements.
- Notify invited users before a meeting starts.
- Archive transcript, notes, references, and source citations after the meeting.
