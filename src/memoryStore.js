import fs from "node:fs/promises";
import path from "node:path";

export function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreDocument(document, queryTokens) {
  const haystack = `${document.title || ""} ${document.kind || ""} ${document.text || ""}`.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
    if (String(document.title || "").toLowerCase().includes(token)) score += 2;
    if (String(document.kind || "").toLowerCase().includes(token)) score += 1;
  }

  return score;
}

function scoreRecord(record, queryTokens) {
  const haystack = [
    record.title,
    record.recordType,
    record.meetingTitle,
    record.agendaItem,
    record.person,
    record.role,
    record.topic,
    record.stance,
    record.claim,
    record.evidence
  ].join(" ").toLowerCase();

  let score = 0;

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
    if (String(record.title || "").toLowerCase().includes(token)) score += 2;
    if (String(record.topic || "").toLowerCase().includes(token)) score += 3;
    if (String(record.person || "").toLowerCase().includes(token)) score += 2;
    if (String(record.agendaItem || "").toLowerCase().includes(token)) score += 2;
  }

  return score;
}

async function readJsonl(filePath) {
  const raw = await fs.readFile(filePath, "utf8").catch(() => "");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export class MemoryStore {
  constructor({ rootDir }) {
    this.rootDir = rootDir;
    this.documentsPath = path.join(rootDir, "data", "memory", "documents.jsonl");
    this.recordsPath = path.join(rootDir, "data", "memory", "records.jsonl");
    this.documents = [];
    this.records = [];
  }

  async load() {
    await fs.mkdir(path.dirname(this.documentsPath), { recursive: true });
    this.documents = await readJsonl(this.documentsPath);
    this.records = await readJsonl(this.recordsPath);
    return { documents: this.documents, records: this.records };
  }

  list({ limit = 25 } = {}) {
    return this.documents.slice(0, limit);
  }

  listRecords({ limit = 50 } = {}) {
    return this.records.slice(0, limit);
  }

  search(query, { limit = 5 } = {}) {
    const queryTokens = tokenize(query);
    if (!queryTokens.length) return [];

    return this.documents
      .map((document) => ({ ...document, score: scoreDocument(document, queryTokens) }))
      .filter((document) => document.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  searchRecords(query, { limit = 8, topic, person, stance } = {}) {
    const queryTokens = tokenize(query);
    const topicNeedle = String(topic || "").toLowerCase();
    const personNeedle = String(person || "").toLowerCase();
    const stanceNeedle = String(stance || "").toLowerCase();

    return this.records
      .filter((record) => {
        if (topicNeedle && String(record.topic || "").toLowerCase() !== topicNeedle) return false;
        if (stanceNeedle && String(record.stance || "").toLowerCase() !== stanceNeedle) return false;
        if (personNeedle) {
          const recordPerson = `${record.person || ""} ${record.role || ""}`.toLowerCase();
          if (!recordPerson.includes(personNeedle) && !personNeedle.includes(recordPerson.trim())) return false;
        }
        return true;
      })
      .map((record) => ({ ...record, score: queryTokens.length ? scoreRecord(record, queryTokens) : 1 }))
      .filter((record) => record.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(b.meetingDate || "").localeCompare(String(a.meetingDate || ""));
      })
      .slice(0, limit);
  }
}
