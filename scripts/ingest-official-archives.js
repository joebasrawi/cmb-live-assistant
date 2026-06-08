import fs from "node:fs/promises";
import path from "node:path";

const PRIMEGOV_BASE = "https://miamibeachfl.primegov.com";
const WEBLINK_BASE = "https://docmgmt.miamibeachfl.gov/WebLink";
const ROOT_DIR = process.cwd();
const FROM_YEAR = Number(readArg("--from-year") || 2020);
const TO_YEAR = Number(readArg("--to-year") || new Date().getFullYear());
const MAX_WEBLINK_RECORDS = Number(readArg("--max-weblink-records") || 5000);

const OUT_DIR = path.join(ROOT_DIR, "data", "archive");
const PUBLIC_OUT_DIR = path.join(ROOT_DIR, "public", "data");
const PUBLIC_RECORDS_OUT = path.join(PUBLIC_OUT_DIR, "official-archive-records.jsonl");
const PUBLIC_SUMMARY_OUT = path.join(PUBLIC_OUT_DIR, "official-archive-summary.json");

const weblinkFolders = [
  { category: "Ordinances", entryId: 258869, year: 2020 },
  { category: "Ordinances", entryId: 265197, year: 2021 },
  { category: "Ordinances", entryId: 278642, year: 2022 },
  { category: "Ordinances", entryId: 287607, year: 2023 },
  { category: "Ordinances", entryId: 293923, year: 2024 },
  { category: "Ordinances", entryId: 299489, year: 2025 },
  { category: "Ordinances", entryId: 316071, year: 2026 },
  { category: "Resolutions", entryId: 274961, year: 2020 },
  { category: "Resolutions", entryId: 315666, year: 2026 },
  { category: "Letters to Commission", entryId: 244798, year: 2020 },
  { category: "Letters to Commission", entryId: 264838, year: 2021 },
  { category: "Letters to Commission", entryId: 274824, year: 2022 },
  { category: "Letters to Commission", entryId: 286435, year: 2023 },
  { category: "Letters to Commission", entryId: 293249, year: 2024 },
  { category: "Letters to Commission", entryId: 299069, year: 2025 },
  { category: "Letters to Commission", entryId: 315498, year: 2026 },
  { category: "Business Impact Estimate", entryId: 292018, year: 2023 },
  { category: "Business Impact Estimate", entryId: 293497, year: 2024 },
  { category: "Business Impact Estimate", entryId: 299092, year: 2025 },
  { category: "Business Impact Estimate", entryId: 315490, year: 2026 },
  { category: "Video Links", entryId: 119318, year: 2020, shallow: true }
].filter((folder) => folder.year >= FROM_YEAR && folder.year <= TO_YEAR);

function readArg(name) {
  const raw = process.argv.find((arg) => arg === name || arg.startsWith(`${name}=`));
  if (!raw) return "";
  if (raw === name) return "true";
  return raw.slice(name.length + 1);
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function postWeblink(endpoint, body) {
  const response = await fetch(`${WEBLINK_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lf-Suppress-Login-Redirect": "1"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${endpoint}`);
  const payload = await response.json();
  return payload.d ?? payload.data ?? payload;
}

async function listFolder(folderId) {
  const first = await postWeblink("FolderListingService.aspx/GetFolderListing2", {
    repoName: "CityClerk",
    folderId,
    getNewListing: true,
    start: 0,
    end: 500,
    sortColumn: "Name",
    sortAscending: true
  });

  const total = Number(first.totalEntries || first.results?.length || 0);
  const results = [...(first.results || [])];
  for (let start = 500; start < total; start += 500) {
    const page = await postWeblink("FolderListingService.aspx/GetFolderListing2", {
      repoName: "CityClerk",
      folderId,
      getNewListing: false,
      start,
      end: start + 500,
      sortColumn: "Name",
      sortAscending: true
    });
    results.push(...(page.results || []));
  }
  return { ...first, results };
}

async function ingestPrimeGov() {
  const records = [];
  const upcoming = await getJson(`${PRIMEGOV_BASE}/api/v2/PublicPortal/ListUpcomingMeetings`);
  for (const meeting of payloadList(upcoming)) {
    records.push(primeGovMeetingRecord(meeting, "upcoming"));
    records.push(...primeGovDocumentRecords(meeting, "upcoming"));
  }

  for (let year = FROM_YEAR; year <= TO_YEAR; year += 1) {
    const archived = await getJson(`${PRIMEGOV_BASE}/api/v2/PublicPortal/ListArchivedMeetings?year=${year}`);
    for (const meeting of payloadList(archived)) {
      records.push(primeGovMeetingRecord(meeting, "archived"));
      records.push(...primeGovDocumentRecords(meeting, "archived"));
    }
  }
  return records;
}

function payloadList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.value)) return payload.value;
  if (Array.isArray(payload?.Value)) return payload.Value;
  return [];
}

function primeGovMeetingRecord(meeting, status) {
  const date = isoDate(meeting.dateTime);
  return cleanRecord({
    id: `primegov-meeting-${meeting.id}`,
    title: `${meeting.title} (${meeting.date || date})`,
    recordType: `primegov-${status}-meeting`,
    meetingDate: date,
    meetingTitle: meeting.title,
    person: "City of Miami Beach",
    role: "Official meeting record",
    stance: "record-exists",
    claim: `PrimeGov lists ${meeting.title} for ${meeting.date || date} at ${meeting.time || "scheduled time"}.`,
    evidence: [
      meeting.videoUrl ? `Video: ${meeting.videoUrl}` : "",
      meeting.allowPublicComment ? "Public comment enabled." : "",
      meeting.allowPublicSpeaker ? "Request to speak enabled." : ""
    ].filter(Boolean).join(" "),
    sourceUrl: `${PRIMEGOV_BASE}/public/portal`,
    topic: inferPrimeGovTopic(meeting, ""),
    sourceId: "official-primegov",
    externalId: meeting.id,
    committeeId: meeting.committeeId,
    meetingTypeId: meeting.meetingTypeId,
    year: date ? Number(date.slice(0, 4)) : undefined
  });
}

function primeGovDocumentRecords(meeting, status) {
  const date = isoDate(meeting.dateTime);
  return (meeting.documentList || []).map((doc) => {
    const isVoteSummary = !doc.templateId || doc.templateId <= 0;
    const meetingParam = isVoteSummary ? `compiledMeetingDocumentFileId=${doc.id}` : `meetingTemplateId=${doc.templateId}`;
    const pathName = doc.compileOutputType === 3 ? "/Portal/Meeting" : "/Public/CompiledDocument";
    const sourceUrl = `${PRIMEGOV_BASE}${pathName}?${meetingParam}${doc.compileOutputType === 3 ? "" : `&compileOutputType=${doc.compileOutputType}`}`;
    return cleanRecord({
      id: `primegov-document-${meeting.id}-${doc.id}`,
      title: `${doc.templateName || "Meeting document"}: ${meeting.title} (${meeting.date || date})`,
      recordType: `primegov-${status}-document`,
      meetingDate: date,
      meetingTitle: meeting.title,
      person: "City Clerk",
      role: "Meeting agenda system",
      topic: inferPrimeGovTopic(meeting, doc.templateName),
      stance: "record-exists",
      claim: `Official ${doc.templateName || "meeting document"} for ${meeting.title} on ${meeting.date || date}.`,
      evidence: `PrimeGov document id ${doc.id}; template id ${doc.templateId || "n/a"}.`,
      sourceUrl,
      sourceId: "official-primegov",
      externalId: doc.id,
      committeeId: meeting.committeeId,
      meetingTypeId: meeting.meetingTypeId,
      year: date ? Number(date.slice(0, 4)) : undefined
    });
  });
}

function inferPrimeGovTopic(meeting, label) {
  if (meeting.committeeId === 2) return "commission meeting";
  return inferTopic(`${meeting.title} ${label || ""}`);
}

async function ingestWeblink() {
  const records = [];
  const seenFolders = new Set();
  for (const folder of weblinkFolders) {
    await crawlWeblinkFolder(folder, records, seenFolders, 0);
    if (records.length >= MAX_WEBLINK_RECORDS) break;
  }
  return records.slice(0, MAX_WEBLINK_RECORDS);
}

async function crawlWeblinkFolder(folder, records, seenFolders, depth) {
  if (records.length >= MAX_WEBLINK_RECORDS) return;
  if (seenFolders.has(folder.entryId)) return;
  seenFolders.add(folder.entryId);

  const listing = await listFolder(folder.entryId);
  records.push(weblinkRecord({
    entry: { name: listing.name, entryId: folder.entryId, type: 0 },
    category: folder.category,
    year: folder.year,
    parentPath: listing.path,
    isContainer: true
  }));

  for (const entry of listing.results || []) {
    if (records.length >= MAX_WEBLINK_RECORDS) return;
    if (folder.shallow && !entryLooksInRange(entry.name)) continue;
    const entryYear = inferYear(entry.name) || folder.year;
    if (entryYear && (entryYear < FROM_YEAR || entryYear > TO_YEAR)) continue;
    records.push(weblinkRecord({ entry, category: folder.category, year: entryYear, parentPath: listing.path }));
    if (entry.type === 0 && depth < 5) {
      await crawlWeblinkFolder(
        { ...folder, entryId: entry.entryId, year: entryYear || folder.year, shallow: false },
        records,
        seenFolders,
        depth + 1
      );
    }
  }
}

function weblinkRecord({ entry, category, year, parentPath, isContainer = false }) {
  const name = String(entry.name || "Official record");
  const recordType = isContainer || entry.type === 0 ? "weblink-folder" : `weblink-${entry.extension || "document"}`;
  const date = inferDate(`${name} ${parentPath || ""}`, year);
  const sourceUrl = `${WEBLINK_BASE}/Browse.aspx?id=${entry.entryId}&dbid=0&repo=CityClerk`;
  return cleanRecord({
    id: `weblink-${entry.entryId}`,
    title: `${category}: ${name}`,
    recordType,
    meetingDate: date,
    meetingTitle: parentPath,
    person: category.includes("Commission") ? "City Commission" : "City Clerk",
    role: "Official Laserfiche/WebLink record",
    topic: inferTopic(`${category} ${name}`),
    stance: "record-exists",
    claim: `Official City Clerk ${category} record: ${name}.`,
    evidence: [entry.extension ? `File type: ${entry.extension}` : "", parentPath ? `Folder: ${parentPath}` : ""]
      .filter(Boolean)
      .join(" "),
    sourceUrl,
    sourceId: "official-weblink",
    externalId: entry.entryId,
    year
  });
}

function inferTopic(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("ltc") || text.includes("letter")) return "LTC";
  if (text.includes("ordinance")) return "ordinance";
  if (text.includes("resolution")) return "resolution";
  if (text.includes("business impact")) return "business impact estimate";
  if (text.includes("video")) return "video";
  if (text.includes("commission")) return "commission meeting";
  if (text.includes("finance")) return "finance";
  if (text.includes("land use")) return "land use";
  if (text.includes("public safety")) return "public safety";
  return "official record";
}

function inferYear(value) {
  const match = String(value || "").match(/\b(20[2-9][0-9])\b/);
  return match ? Number(match[1]) : undefined;
}

function inferDate(value, fallbackYear) {
  const text = String(value || "");
  const iso = text.match(/\b(20[2-9][0-9])[-_/](0?[1-9]|1[0-2])[-_/](0?[1-9]|[12][0-9]|3[01])\b/);
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  const us = text.match(/\b(0?[1-9]|1[0-2])[-_/](0?[1-9]|[12][0-9]|3[01])[-_/](20[2-9][0-9])\b/);
  if (us) return `${us[3]}-${pad(us[1])}-${pad(us[2])}`;
  const year = inferYear(text) || fallbackYear;
  return year ? `${year}-01-01` : undefined;
}

function isoDate(value) {
  if (!value) return undefined;
  return String(value).slice(0, 10);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function entryLooksInRange(value) {
  const year = inferYear(value);
  if (year) return year >= FROM_YEAR && year <= TO_YEAR;
  return /\b(0?[1-9]|1[0-2])[-_/](0?[1-9]|[12][0-9]|3[01])[-_/](20[2-9][0-9])\b/.test(String(value || ""));
}

function cleanRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function dedupe(records) {
  return [...new Map(records.map((record) => [record.id, record])).values()].sort((a, b) => {
    const dateSort = String(b.meetingDate || "").localeCompare(String(a.meetingDate || ""));
    if (dateSort) return dateSort;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

function toJsonl(records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_OUT_DIR, { recursive: true });

  const [primeGovRecords, weblinkRecords] = await Promise.all([ingestPrimeGov(), ingestWeblink()]);
  const records = dedupe([...primeGovRecords, ...weblinkRecords]);
  const jsonl = toJsonl(records);
  const summary = {
    generatedAt: new Date().toISOString(),
    fromYear: FROM_YEAR,
    toYear: TO_YEAR,
    recordCount: records.length,
    primeGovCount: primeGovRecords.length,
    weblinkCount: weblinkRecords.length,
    byType: countBy(records, "recordType"),
    byTopic: countBy(records, "topic"),
    sources: {
      primeGov: `${PRIMEGOV_BASE}/public/portal`,
      weblink: `${WEBLINK_BASE}/Browse.aspx?id=120704&dbid=0&repo=CityClerk`
    }
  };

  await fs.writeFile(path.join(OUT_DIR, "official-index.jsonl"), jsonl);
  await fs.writeFile(path.join(OUT_DIR, "official-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(PUBLIC_RECORDS_OUT, jsonl);
  await fs.writeFile(PUBLIC_SUMMARY_OUT, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
