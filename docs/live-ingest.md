# Live Ingest Plan

Miami Beach states that City Commission, board, and committee meetings are aired on MBTV and live-streamed on YouTube at the City of Miami Beach channel. The first production ingest path should therefore target the official live stream.

## MVP Modes

1. Demo mode
   - Uses scripted transcript segments.
   - Good for testing UI, notes, retrieval, and multi-viewer behavior.

2. Manual transcript mode
   - Any captioning or transcription source can POST transcript segments to:

```http
POST /api/sessions/:id/transcript
Content-Type: application/json

{
  "speaker": "Commissioner",
  "text": "Can staff pull up R7B and the prior LTC on Ocean Drive?",
  "isFinal": true
}
```

3. Live audio mode
   - Use the official YouTube/MBTV stream as the source.
   - Capture audio with a media worker.
   - Convert audio to 24 kHz mono PCM.
   - Stream it to a realtime transcription session.
   - POST final transcript segments into the live room.

## OpenAI API Fit

OpenAI's Realtime API supports streaming transcription sessions. The current docs identify `gpt-realtime-whisper` for live audio transcript deltas and describe WebSocket or WebRTC connection options. For a server-side broadcast ingest worker, WebSocket is the better fit because the server receives the audio stream and controls tools privately.

The Responses API can then generate source-backed notes using file search, vector stores, and custom function tools. For this app, custom functions should handle:

- `search_current_agenda`
- `search_historical_meetings`
- `get_item_packet`
- `get_vote_history`
- `get_related_ltc`
- `pin_reference`

## Tooling Needed

- FFmpeg: installed in this environment.
- yt-dlp or a YouTube Data API path: needed to resolve the active live audio stream.
- OpenAI API key: needed for realtime transcription and note generation.
- Production auth: needed before sharing with commissioners.
