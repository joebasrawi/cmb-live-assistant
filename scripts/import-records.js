import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const recordsPath = path.join(rootDir, "data", "memory", "records.jsonl");
const sourcePath = process.argv[2];

const REQUIRED_FIELDS = ["id", "title", "recordType", "meetingDate", "topic", "stance", "claim", "sourceUrl"];

function usage() {
  console.log("Usage: node scripts/import-records.js <records.json-or-jsonl>");
}

function parseInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function validateRecord(record) {
  const missing = REQUIRED_FIELDS.filter((field) => !record[field]);
  if (missing.length) {
    throw new Error(`Record ${record.id || "(no id)"} missing required fields: ${missing.join(", ")}`);
  }
}

async function readExistingIds() {
  const raw = await fs.readFile(recordsPath, "utf8").catch(() => "");
  return new Set(
    raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line).id)
  );
}

if (!sourcePath) {
  usage();
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), sourcePath);
const input = parseInput(await fs.readFile(inputPath, "utf8"));
const existingIds = await readExistingIds();
const newRecords = [];

for (const record of input) {
  validateRecord(record);
  if (!existingIds.has(record.id)) {
    newRecords.push(record);
    existingIds.add(record.id);
  }
}

if (newRecords.length) {
  await fs.mkdir(path.dirname(recordsPath), { recursive: true });
  await fs.appendFile(recordsPath, `${newRecords.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

console.log(`Imported ${newRecords.length} new record${newRecords.length === 1 ? "" : "s"} into ${recordsPath}`);
