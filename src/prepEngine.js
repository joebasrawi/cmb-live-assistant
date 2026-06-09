const QUESTION_RULES = [
  {
    label: "Fiscal",
    patterns: [/budget/i, /fiscal/i, /appropriation/i, /cost/i],
    question: "Can staff state the fiscal impact and whether a budget amendment or future appropriation is required?"
  },
  {
    label: "Procurement",
    patterns: [/procurement/i, /\brfp\b/i, /\brfq\b/i, /contract/i, /bid/i],
    question: "Can Procurement or the City Attorney confirm the procurement authority and whether this was competitively sourced?"
  },
  {
    label: "Legal",
    patterns: [/ordinance/i, /resolution/i, /agreement/i, /waiver/i],
    question: "Can the City Attorney confirm the legal form, authority, and any implementation conditions before the vote?"
  },
  {
    label: "History",
    patterns: [/prior/i, /previous/i, /ltc/i, /letter to commission/i, /history/i],
    question: "Has this item, or a substantially similar item, come before the Commission before, and what changed?"
  }
];

function compactRecord(record) {
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
    timestamp: record.timestamp,
    sourceId: record.sourceId
  };
}

function inferFlags(records) {
  const text = records
    .map((record) => `${record.title || ""} ${record.claim || ""} ${record.evidence || ""} ${record.topic || ""}`)
    .join(" ");

  return [
    { id: "fiscal", label: "Fiscal", active: /budget|fiscal|appropriation|cost|funding/i.test(text) },
    { id: "procurement", label: "Procurement", active: /procurement|\brfp\b|\brfq\b|contract|bid/i.test(text) },
    { id: "legal", label: "Legal form", active: /ordinance|resolution|agreement|waiver/i.test(text) },
    { id: "history", label: "Prior record", active: records.length > 1 }
  ];
}

function questionsFor(records) {
  const text = records
    .map((record) => `${record.title || ""} ${record.claim || ""} ${record.evidence || ""} ${record.topic || ""}`)
    .join(" ");
  const questions = [];

  for (const rule of QUESTION_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      questions.push({ label: rule.label, question: rule.question });
    }
  }

  questions.push(
    {
      label: "Scope",
      question: "Can staff state exactly what action the Commission is taking today and what authority it gives the Administration?"
    },
    {
      label: "Timeline",
      question: "What is the implementation timeline, and when will staff report back if this is approved?"
    },
    {
      label: "Source",
      question: "Which agenda memo, LTC, resolution, ordinance, or prior vote should we rely on as the official source for this item?"
    }
  );

  const seen = new Set();
  return questions.filter((item) => {
    if (seen.has(item.question)) return false;
    seen.add(item.question);
    return true;
  }).slice(0, 6);
}

function titleFor(records, query) {
  const current = records.find((record) => /primegov-upcoming|agenda/i.test(`${record.recordType || ""} ${record.title || ""}`));
  return current?.meetingTitle || current?.title || query || "Current meeting prep";
}

export function buildMeetingPrep({ memoryStore, query = "" }) {
  const currentAgenda = memoryStore.currentAgendaRecords({ limit: 20 });
  const queryRecords = query
    ? memoryStore.searchRecords(query, { limit: 10 })
    : [];
  const recordsById = new Map();

  for (const record of [...currentAgenda, ...queryRecords]) {
    if (record?.id) recordsById.set(record.id, compactRecord(record));
  }

  const records = [...recordsById.values()].slice(0, 12);
  const flags = inferFlags(records);
  const activeFlags = flags.filter((flag) => flag.active).map((flag) => flag.label);

  return {
    id: `prep-${Date.now()}`,
    at: new Date().toISOString(),
    title: titleFor(records, query),
    summary: records.length
      ? `${records.length} current or related source record${records.length === 1 ? "" : "s"} are ready. Key checks: ${activeFlags.length ? activeFlags.join(", ") : "scope, source, timeline"}.`
      : "No current agenda records are loaded yet. Use the official PrimeGov agenda as the first source.",
    flags,
    questions: questionsFor(records),
    sources: records
  };
}
