import { randomUUID } from "node:crypto";
import { tokenize } from "./memoryStore.js";

const TOPIC_PATTERNS = [
  { topic: "Ocean Drive", patterns: [/ocean drive/i, /lummus park/i, /art deco/i] },
  { topic: "budget", patterns: [/budget/i, /appropriation/i, /amendment/i, /millage/i, /fiscal impact/i, /\bcost/i] },
  { topic: "procurement", patterns: [/\brfp\b/i, /\brfq\b/i, /\bbid\b/i, /procurement/i, /contract/i] },
  { topic: "housing", patterns: [/housing/i, /live local/i, /workforce/i, /affordable/i] },
  { topic: "transportation", patterns: [/transit/i, /parking/i, /mobility/i, /bike/i, /traffic/i] },
  { topic: "public safety", patterns: [/police/i, /fire/i, /emergency/i, /public safety/i] },
  { topic: "resilience", patterns: [/resilien/i, /stormwater/i, /sea level/i, /flood/i] }
];

const STANCE_RULES = [
  { stance: "support", label: "support", patterns: [/\bsupport(?:ed|s|ing)?\b/i, /\bin favor\b/i, /\bvoted yes\b/i] },
  { stance: "oppose", label: "opposition", patterns: [/\boppos(?:e|ed|es|ing)\b/i, /\bagainst\b/i, /\bdo not support\b/i, /\bvoted no\b/i] },
  { stance: "no-fiscal-impact", label: "no fiscal impact", patterns: [/no fiscal impact/i, /does not cost/i, /no cost/i, /cost neutral/i] },
  { stance: "fiscal-impact", label: "fiscal impact", patterns: [/fiscal impact/i, /budget amendment/i, /appropriation/i, /\bcosts?\b/i] },
  { stance: "no-procurement", label: "no procurement tie", patterns: [/not tied to (?:an? )?rfp/i, /not .* tied to .*rfp/i, /do not believe .*rfp/i, /no rfp/i, /no procurement/i, /not procurement/i] },
  { stance: "procurement", label: "procurement tie", patterns: [/\brfp\b/i, /\brfq\b/i, /procurement/i, /competitive bid/i] },
  { stance: "unprecedented", label: "unprecedented claim", patterns: [/never discussed/i, /first time/i, /unprecedented/i, /no prior/i, /has not come before/i] }
];

const OPPOSING_STANCES = {
  support: new Set(["oppose"]),
  oppose: new Set(["support"]),
  "no-fiscal-impact": new Set(["fiscal-impact"]),
  "fiscal-impact": new Set(["no-fiscal-impact"]),
  "no-procurement": new Set(["procurement"]),
  procurement: new Set(["no-procurement"]),
  unprecedented: new Set(["prior-discussion", "record-exists", "support", "oppose", "fiscal-impact", "procurement"])
};

const DECISION_PATTERNS = [/before we vote/i, /\bvote\b/i, /\bmotion\b/i, /\bsecond\b/i, /\bdefer\b/i, /\bcontinue\b/i];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractTopics(text, references = []) {
  const topics = [];
  for (const reference of references) {
    if (reference.type === "topic") topics.push(reference.value);
  }
  for (const rule of TOPIC_PATTERNS) {
    if (rule.patterns.some((pattern) => pattern.test(text))) topics.push(rule.topic);
  }
  return unique(topics);
}

function extractStances(text) {
  return STANCE_RULES
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(text)))
    .map((rule) => ({ stance: rule.stance, label: rule.label }));
}

function compactEvidence(record) {
  return {
    id: record.id,
    title: record.title,
    recordType: record.recordType,
    meetingDate: record.meetingDate,
    meetingTitle: record.meetingTitle,
    agendaItem: record.agendaItem,
    person: record.person,
    role: record.role,
    topic: record.topic,
    stance: record.stance,
    claim: record.claim,
    evidence: record.evidence,
    sourceUrl: record.sourceUrl,
    timestamp: record.timestamp
  };
}

function isStrongCurrentClaim(text, stance) {
  if (stance === "unprecedented") return true;
  if (["no-fiscal-impact", "fiscal-impact", "no-procurement", "procurement"].includes(stance)) return true;
  return /\balways\b/i.test(text) || /\bnever\b/i.test(text) || /\bconsistently\b/i.test(text) || /\bI (?:have|had)\b/i.test(text);
}

function personLooksGeneric(person) {
  return /^(unknown|manual|mayor|commissioner|city manager|city attorney|staff|public speaker|test)$/i.test(String(person || "").trim());
}

function personMatchesCurrentSpeaker(record, speaker) {
  if (personLooksGeneric(speaker)) return true;
  const speakerTokens = tokenize(speaker).join(" ");
  const recordTokens = tokenize(`${record.person || ""} ${record.role || ""}`).join(" ");
  if (!speakerTokens || !recordTokens) return true;
  return recordTokens.includes(speakerTokens) || speakerTokens.includes(recordTokens);
}

function conflicts(currentStance, priorStance) {
  return Boolean(OPPOSING_STANCES[currentStance]?.has(priorStance));
}

function dedupeAlerts(alerts) {
  const seen = new Set();
  const result = [];
  for (const alert of alerts) {
    const key = `${alert.type}:${alert.title}:${alert.evidence.map((item) => item.id).join(",")}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(alert);
    }
  }
  return result;
}

export class ProactiveWatcher {
  constructor({ memoryStore }) {
    this.memoryStore = memoryStore;
  }

  analyze({ segment, references = [] }) {
    const text = segment.text || "";
    const topics = extractTopics(text, references);
    const stances = extractStances(text);
    const alerts = [];

    for (const topic of topics) {
      alerts.push(...this.findContradictions({ segment, topic, stances }));
      alerts.push(...this.findPriorRecordContext({ segment, topic, stances }));
    }

    const decisionAlert = this.findDecisionSupport({ segment, references, topics });
    if (decisionAlert) alerts.push(decisionAlert);

    return dedupeAlerts(alerts).slice(0, 5);
  }

  findContradictions({ segment, topic, stances }) {
    const alerts = [];
    const strongStances = stances.filter((item) => isStrongCurrentClaim(segment.text, item.stance));

    for (const current of strongStances) {
      const priorRecords = this.memoryStore
        .searchRecords(`${segment.speaker} ${topic} ${current.stance}`, { topic, limit: 8 })
        .filter((record) => conflicts(current.stance, record.stance))
        .filter((record) => current.stance === "unprecedented" || personMatchesCurrentSpeaker(record, segment.speaker));

      if (!priorRecords.length) continue;

      const evidence = priorRecords.slice(0, 3).map(compactEvidence);
      alerts.push({
        id: randomUUID(),
        type: "possible-contradiction",
        priority: "high",
        at: segment.at,
        title: `Possible inconsistency on ${topic}`,
        body: `The live statement sounds like ${current.label}, but prior records in memory point the other way.`,
        recommendation: "Use this as a source-backed prompt: ask staff to confirm the prior record before relying on the live statement.",
        triggerText: segment.text,
        evidence
      });
    }

    return alerts;
  }

  findPriorRecordContext({ segment, topic, stances }) {
    const asksForHistory = /prior|previous|history|before|remind|pull up|record|ltc|memo|resolution|ordinance/i.test(segment.text);
    const claimsNoHistory = stances.some((item) => item.stance === "unprecedented");
    if (!asksForHistory && !claimsNoHistory) return [];

    const records = this.memoryStore.searchRecords(topic, { topic, limit: 4 });
    if (!records.length) return [];

    return [{
      id: randomUUID(),
      type: claimsNoHistory ? "prior-record-differs" : "prior-record-found",
      priority: claimsNoHistory ? "high" : "medium",
      at: segment.at,
      title: claimsNoHistory ? `Prior record found for ${topic}` : `Relevant prior record: ${topic}`,
      body: claimsNoHistory
        ? "The live statement suggests no prior record, but meeting memory has related prior material."
        : "Meeting memory has related prior material that may help frame the live discussion.",
      recommendation: "Open the source card and verify the current agenda item against the earlier record.",
      triggerText: segment.text,
      evidence: records.slice(0, 4).map(compactEvidence)
    }];
  }

  findDecisionSupport({ segment, references, topics }) {
    if (!DECISION_PATTERNS.some((pattern) => pattern.test(segment.text))) return null;

    const referenceLabels = references
      .filter((reference) => ["agenda-item", "resolution", "ordinance", "ltc"].includes(reference.type))
      .map((reference) => reference.value);

    if (!referenceLabels.length && !topics.length) return null;

    const query = [...referenceLabels, ...topics].join(" ");
    const records = this.memoryStore.searchRecords(query, { limit: 5 });

    return {
      id: randomUUID(),
      type: "decision-support",
      priority: "medium",
      at: segment.at,
      title: "Vote-time context check",
      body: "A vote or motion may be imminent. The assistant pulled related prior records for a quick dais check.",
      recommendation: "Confirm item title, fiscal impact, procurement path, sponsor, and any prior vote before the motion is finalized.",
      triggerText: segment.text,
      evidence: records.slice(0, 5).map(compactEvidence)
    };
  }
}
