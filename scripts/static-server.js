import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.STATIC_PORT || 8790);

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jsonl": "application/x-ndjson; charset=utf-8"
  }[ext] || "application/octet-stream";
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;

  if (url.pathname.startsWith("/api/")) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Static preview has no API" }));
    return;
  }

  const filePath = path.join(publicDir, path.normalize(requested).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypeFor(filePath), "Cache-Control": "no-store" });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Static CMB preview running at http://localhost:${port}`);
});
