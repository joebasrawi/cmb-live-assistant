import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStore } from "./memoryStore.js";
import { LiveAssistant } from "./liveAssistant.js";
import { ProactiveWatcher } from "./proactiveWatcher.js";
import { answerQuestion } from "./answerEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 8788);

const memoryStore = new MemoryStore({ rootDir });
await memoryStore.load();

const proactiveWatcher = new ProactiveWatcher({ memoryStore });
const assistant = new LiveAssistant({ memoryStore, proactiveWatcher, rootDir });
const defaultSession = assistant.createSession({
  title: "CMB Commission live room",
  sourceUrl: process.env.CMB_DEFAULT_LIVE_URL
});

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found" });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function isAuthorized(request, url) {
  if (!process.env.ACCESS_TOKEN) return true;
  const header = request.headers.authorization || "";
  return header === `Bearer ${process.env.ACCESS_TOKEN}` || url.searchParams.get("access_token") === process.env.ACCESS_TOKEN;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jsonl": "application/x-ndjson; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

async function serveStatic(request, response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) return notFound(response);

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "no-store"
    });
    response.end(data);
  } catch {
    notFound(response);
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, {
      ok: true,
      service: "cmb-live-assistant",
      defaultSessionId: defaultSession.id
    });
  }

  if (!isAuthorized(request, url)) {
    return sendJson(response, 401, { error: "Unauthorized" });
  }

  if (request.method === "GET" && url.pathname === "/api/memory") {
    return sendJson(response, 200, { documents: memoryStore.list({ limit: 100 }) });
  }

  if (request.method === "GET" && url.pathname === "/api/memory/search") {
    const q = url.searchParams.get("q") || "";
    return sendJson(response, 200, { q, results: memoryStore.search(q, { limit: 10 }) });
  }

  if (request.method === "GET" && url.pathname === "/api/records") {
    return sendJson(response, 200, { records: memoryStore.listRecords({ limit: 200 }), totalRecordCount: memoryStore.countRecords() });
  }

  if (request.method === "GET" && url.pathname === "/api/records/search") {
    const q = url.searchParams.get("q") || "";
    const topic = url.searchParams.get("topic") || undefined;
    return sendJson(response, 200, { q, results: memoryStore.searchRecords(q, { topic, limit: 20 }) });
  }

  if (request.method === "POST" && url.pathname === "/api/ask") {
    const body = await readJson(request);
    const answer = answerQuestion({ memoryStore, question: body.question });
    return sendJson(response, 200, { answer });
  }

  if (request.method === "GET" && url.pathname === "/api/sessions") {
    return sendJson(response, 200, { sessions: assistant.listSessions(), defaultSessionId: defaultSession.id });
  }

  if (request.method === "POST" && url.pathname === "/api/sessions") {
    const body = await readJson(request);
    return sendJson(response, 201, { session: assistant.createSession(body) });
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)(?:\/([^/]+))?$/);
  if (sessionMatch) {
    const [, sessionId, action] = sessionMatch;

    if (request.method === "GET" && !action) {
      const session = assistant.getSession(sessionId);
      return session ? sendJson(response, 200, { session }) : notFound(response);
    }

    if (request.method === "GET" && action === "events") {
      if (!assistant.getSession(sessionId)) return notFound(response);
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        "Connection": "keep-alive"
      });
      response.write("event: ready\ndata: {}\n\n");
      assistant.subscribe(sessionId, response);
      request.on("close", () => assistant.unsubscribe(sessionId, response));
      return;
    }

    if (request.method === "POST" && action === "transcript") {
      const body = await readJson(request);
      const session = await assistant.addTranscript(sessionId, body);
      return session ? sendJson(response, 200, { session }) : notFound(response);
    }

    if (request.method === "POST" && action === "start-demo") {
      const session = assistant.startDemo(sessionId);
      return session ? sendJson(response, 200, { session }) : notFound(response);
    }

    if (request.method === "POST" && action === "stop") {
      const session = assistant.stopDemo(sessionId);
      return session ? sendJson(response, 200, { session }) : notFound(response);
    }
  }

  notFound(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    await serveStatic(request, response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`CMB Live Assistant running at http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
