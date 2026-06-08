# Production Launch Notes

This repo now has the pieces for a strong prototype:

- A dark commissioner-facing dashboard in `public/`.
- A local Node backend with live transcript events, proactive alerts, and source-backed chat.
- A 2020-forward official metadata ingest from PrimeGov and City Clerk Laserfiche/WebLink.
- A public GitHub Pages demo that can search the generated official archive index.

## Current Official Index

Generated with:

```powershell
node scripts/ingest-official-archives.js --from-year=2020 --max-weblink-records=20000
```

The current index includes:

- PrimeGov upcoming and archived meetings, agendas, minutes, and packets.
- City Clerk ordinances.
- City Clerk resolutions.
- Letters to Commission.
- Business Impact Estimates.
- City Clerk video link records where exposed through WebLink metadata.

The generated files are:

- `data/archive/official-index.jsonl`
- `data/archive/official-summary.json`
- `public/data/official-archive-records.jsonl`
- `public/data/official-archive-summary.json`

`data/archive/official-index.jsonl` is a local generated cache and is ignored by Git. The committed searchable index is `public/data/official-archive-records.jsonl`, which is used by both the public demo and local backend.

## What Still Needs Paid/External Setup

- OpenAI API key for live transcription, retrieval, and reasoning.
- A production backend host such as Render, Fly.io, Railway, AWS, Azure, or a small VPS.
- A private login layer for the commissioner and staff. Do not rely on a public GitHub Pages demo for dais use.
- A live audio/video source with permission and a stable URL, such as MBTV, YouTube, Zoom, or room audio.
- Storage for raw PDFs, video files, and full transcripts. Use the RAID/NAS or cloud object storage; do not put raw archives in Git.
- Optional but recommended: a domain such as `dais.yourdomain.com`.
- Recommended for serious archive search: Postgres with `pgvector`, Supabase, Pinecone, Weaviate, or OpenAI vector stores.

## Storage Guidance

The committed public archive is metadata plus official source links, about 10 MB per copy. That is fine for the demo.

Full raw archive storage is a different project. Downloading every PDF, packet, transcript, and meeting video from 2020 forward will likely become many gigabytes, possibly much more if full videos are retained. Put raw downloads under `data/archive/raw/` or `data/archive/downloads/`; those folders are ignored by Git.

## Live Meeting Path

1. Deploy the Node backend behind HTTPS with `ACCESS_TOKEN` enabled.
2. Point `CMB_DEFAULT_LIVE_URL` at the official live feed.
3. Add a transcription worker that posts final transcript lines to:

```text
POST /api/sessions/:sessionId/transcript
```

4. Add retrieval over the official archive index and full extracted text.
5. Require every recommendation to show source cards and confidence.
6. Test on the actual dais device before the meeting.
