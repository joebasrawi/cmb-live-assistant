# Railway Deployment

This app is now configured for Railway with `railway.json`.

## Deploy From GitHub

1. In Railway, create a new project.
2. Choose **Deploy from GitHub repo**.
3. Select `joebasrawi/cmb-live-assistant`.
4. Use the `main` branch.
5. Railway should pick up `railway.json`.

## Required Variables

Set these in the Railway service variables:

```text
ACCESS_TOKEN=<make-a-long-random-password>
CMB_DEFAULT_LIVE_URL=https://www.youtube.com/cityofmiamibeach
```

Railway provides `PORT` automatically.

## Add Later For Live Intelligence

```text
OPENAI_API_KEY=<your OpenAI API key>
OPENAI_ANSWER_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
TRANSCRIPT_CHUNK_SECONDS=18
```

`OPENAI_API_KEY` is required for the **Start Live** button. The Dockerfile installs `ffmpeg` and `yt-dlp` so Railway can resolve a YouTube live URL and cut live audio into transcription chunks.

## Health Check

Railway should use:

```text
/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "cmb-live-assistant"
}
```

## Important

The Railway URL should be the commissioner-facing live version because it serves the backend and dashboard from the same origin.

The GitHub Pages URL remains a public static archive/demo version.
