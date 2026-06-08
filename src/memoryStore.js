import fs from "node:fs/promises";
import path from "node:path";

const STOPWORDS = new Set([
  "about",
  "and",
  "are",
  "can",
  "could",
  "for",
  "from",
  "into",
  "listed",
  "official",
  "open",
  "please",
  "pull",
  "should",
  "source",
  "sources",
  "that",
  "the",
  "this",
  "use",
  "using",
  "was",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would"
]);

export function tokenize(value) {
  const tokens = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  const expanded = new Set(tokens);
  for (const token of tokens) {
    if (token.endsWith("s") && token.length > 4) expanded.add(token.slice(0, -1));
    if (token === "commissioners") expanded.add("commissioner");
  }
  return [...expanded];
}

function queryDates(value) {
  const text = String(value || "").toLowerCase();
  const dates = new Set();
  const monthMap = new Map([
    ["jan", "01"],
    ["january", "01"],
    ["feb", "02"],
    ["february", "02"],
    ["mar", "03"],
    ["march", "03"],
    ["apr", "04"],
    ["april", "04"],
    ["may", "05"],
    ["jun", "06"],
    ["june", "06"],
    ["jul", "07"],
    ["july", "07"],
    ["aug", "08"],
    ["august", "08"],
    ["sep", "09"],
    ["sept", "09"],
    ["september", "09"],
    ["oct", "10"],
    ["october", "10"],
    ["nov", "11"],
    ["november", "11"],
    ["dec", "12"],
    ["december", "12"]
  ]);

  for (const match of text.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g)) {
    dates.add(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`);
  }
  for (const match of text.matchAll(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/g)) {
    const month = monthMap.get(match[1]);
    if (month) dates.add(`${match[3]}-${month}-${match[2].padStart(2, "0")}`);
  }

  return dates;
}

function queryRecordNumbers(value) {
  return String(value || "")
    .toLowerCase()
    .match(/\b(?:ltc\s*)?\d{2,4}[-/]\d{2,5}\b/g) || [];
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

function scoreRecord(record, queryTokens, dateMatches = new Set()) {
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
  if (dateMatches.has(String(record.meetingDate || ""))) score += 20;

  return score;
}

function scoreOfficialLookup(record, query) {
  const text = String(query || "").toLowerCase();
  const title = String(record.title || "").toLowerCase();
  const claim = String(record.claim || "").toLowerCase();
  const role = String(record.role || "").toLowerCase();
  const type = String(record.recordType || "").toLowerCase();
  const topic = String(record.topic || "").toLowerCase();
  const sourceId = String(record.sourceId || "").toLowerCase();
  const recordNumbers = queryRecordNumbers(text);

  let score = 0;
  const isRoster = type === "official-roster";
  if (isRoster && /\bwho\b|\bofficial roster\b|\blisted by the city\b/.test(text)) score += 12;
  if (isRoster && /\bcity manager\b/.test(text) && (role === "city manager" || title.includes("city manager"))) score += 35;
  if (isRoster && /\bcity clerk\b/.test(text) && (role === "city clerk" || title.includes("city clerk"))) score += 35;
  if (isRoster && /\bmayor\b/.test(text) && (role === "mayor" || title.includes("mayor"))) score += 35;
  if (isRoster && /\bcommissioners?\b/.test(text) && role.includes("commissioner")) score += 30;
  for (const number of recordNumbers) {
    if (title.includes(number) || claim.includes(number)) score += 45;
  }
  if (topic === "ltc" && /\bltcs?\b|letters? to commission/.test(text)) score += 12;
  if (topic === "legislation" && /\bresolution|ordinance/.test(text)) score += 12;
  if (sourceId.includes("city-manager") && /\bcity manager\b/.test(text)) score += 8;
  if (sourceId.includes("mayor") && /\bmayor|commissioners?\b/.test(text)) score += 8;
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
    this.archiveRecordsPath = path.join(rootDir, "public", "data", "official-archive-records.jsonl");
    this.documents = [];
    this.records = [];
  }

  async load() {
    await fs.mkdir(path.dirname(this.documentsPath), { recursive: true });
    this.documents = await readJsonl(this.documentsPath);
    this.records = [
      ...(await readJsonl(this.recordsPath)),
      ...(await readJsonl(this.archiveRecordsPath))
    ];
    return { documents: this.documents, records: this.records };
  }

  list({ limit = 25 } = {}) {
    return this.documents.slice(0, limit);
  }

  listRecords({ limit = 50 } = {}) {
    return this.records.slice(0, limit);
  }

  countRecords() {
    return this.records.length;
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
    const dateMatches = queryDates(query);
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
      .map((record) => ({
        ...record,
        score: queryTokens.length || dateMatches.size
          ? scoreRecord(record, queryTokens, dateMatches) + scoreOfficialLookup(record, query)
          : 1 + scoreOfficialLookup(record, query)
      }))
      .filter((record) => record.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(b.meetingDate || "").localeCompare(String(a.meetingDate || ""));
      })
      .slice(0, limit);
  }
}
