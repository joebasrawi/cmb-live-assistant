import { randomUUID } from "node:crypto";
import { tokenize } from "./memoryStore.js";
import { hasUsableOpenAiKey, openAiApiKey } from "./openaiConfig.js";

const PEOPLE = [
  "Steven Meiner",
  "Monica Matteo-Salinas",
  "Laura Dominguez",
  "Alex Fernandez",
  "Tanya K. Bhatt",
  "David Suarez",
  "Joseph Magazine",
  "Eric Carpenter",
  "Rafael E. Granado",
  "Jason Greene"
];

const TOPIC_RULES = [
  ["Ocean Drive", ["ocean drive", "lummus", "art deco"]],
  ["budget", ["budget", "fiscal", "appropriation", "millage"]],
  ["procurement", ["procurement", "rfp", "rfq", "bid", "contract"]],
  ["LTC", ["ltc", "letter to commission"]],
  ["legislation", ["resolution", "ordinance", "legislation"]],
  ["transportation", ["parking", "traffic", "mobility", "transit"]],
  ["live readiness", ["fully live", "working live", "next commission meeting", "real time", "production", "launch"]],
  ["officials", ["mayor", "commissioner", "city manager", "city clerk"]]
];

const OPENAI_ANSWER_MODEL = process.env.OPENAI_ANSWER_MODEL || "gpt-4.1-mini";

function detectPeople(text) {
  const lower = text.toLowerCase();
  return PEOPLE.filter((person) => {
    const variants = [person, person.replace("K. ", ""), person.split(" ").at(-1)].map((item) => item.toLowerCase());
    return variants.some((variant) => variant && lower.includes(variant));
  });
}

function detectTopic(text) {
  const lower = text.toLowerCase();
  return TOPIC_RULES.find(([, needles]) => needles.some((needle) => lower.includes(needle)))?.[0] || "";
}

function compactDocument(document) {
  return {
    id: document.id,
    title: document.title,
    kind: document.kind,
    date: document.date,
    sourceUrl: document.sourceUrl,
    claim: document.text
  };
}

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

function outputText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
}

async function askOpenAI({ question, mode, recommendation, evidence }) {
  if (!hasUsableOpenAiKey() || !evidence.length) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_ANSWER_MODEL,
      instructions: [
        "You are a source-backed live staff assistant for a City of Miami Beach commissioner.",
        "Answer for use during a public meeting. Be concise, neutral, and careful.",
        "Use only the provided evidence. Do not invent dates, votes, quotes, or legal conclusions.",
        "If the evidence is only metadata, say that it is a lead and the source card should be opened.",
        "Prefer wording like 'possible inconsistency' or 'prior record may differ', never accusations."
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                question,
                currentMode: mode,
                defaultRecommendation: recommendation,
                evidence
              })
            }
          ]
        }
      ],
      max_output_tokens: 450
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI answer failed: ${response.status} ${body.slice(0, 200)}`);
  }

  const text = outputText(await response.json());
  return text || null;
}

export async function answerQuestion({ memoryStore, question }) {
  const query = String(question || "").trim();
  const people = detectPeople(query);
  const person = people[0] || "";
  const topic = detectTopic(query);
  const asksInconsistency = /inconsistent|contradict|different|before|previous|prior|said/i.test(query);
  const asksLiveReadiness = /fully live|working live|next commission meeting|live meeting|real time|production|launch/i.test(query);
  const targetedQuery = [query, person, topic].filter(Boolean).join(" ");

  const records = memoryStore.searchRecords(targetedQuery, {
    limit: 8,
    topic: topic && !["LTC", "legislation", "officials"].includes(topic) ? topic : undefined,
    person: person || undefined
  });
  const documents = memoryStore.search(targetedQuery, { limit: 5 });

  let mode = "Source pull";
  let answer = "I found related source records in memory. Treat this as a lead until the official meeting record is opened.";
  let recommendation = "Open the evidence cards, then verify the official agenda packet, LTC, resolution, ordinance, or archived video before using it on the dais.";

  if (asksLiveReadiness) {
    mode = "Launch plan";
    answer = "To make this fully live for the next commission meeting, the core work is archive ingestion, live audio transcription, speaker labeling, secure dais access, and a verification workflow that forces every alert to cite an official source.";
    recommendation = "Start with the official meeting archive and MBTV feed: those unlock real-time transcript, source retrieval, and contradiction checks with confidence labels.";
  } else if (person && topic && asksInconsistency) {
    mode = "Consistency check";
    answer = `${person} has related memory on ${topic}. This can flag possible differences immediately, but a final consistency call needs the official transcript or video timestamp.`;
    recommendation = `Ask staff to confirm ${person}'s prior ${topic} statements using the source cards below.`;
  } else if (person) {
    mode = "Person lookup";
    answer = `I found records tied to ${person}. The strongest matches are shown below.`;
    recommendation = "Use the roster source for identity/role and the meeting records for any substantive claim.";
  } else if (topic) {
    mode = "Topic lookup";
    answer = `I found records and city source indexes for ${topic}.`;
    recommendation = "Use agendas for meeting items, LTCs for staff updates, and resolutions or ordinances for adopted actions.";
  }

  const evidenceMap = new Map();
  for (const record of records.map(compactRecord)) evidenceMap.set(record.id, record);
  for (const document of documents.map(compactDocument)) evidenceMap.set(document.id, document);

  const answerPayload = {
    id: randomUUID(),
    at: new Date().toISOString(),
    question: query,
    mode,
    answer,
    recommendation,
    evidence: [...evidenceMap.values()].slice(0, 8),
    tokens: tokenize(query)
  };

  try {
    const aiAnswer = await askOpenAI({
      question: query,
      mode,
      recommendation,
      evidence: answerPayload.evidence
    });
    if (aiAnswer) {
      answerPayload.mode = `${mode} + AI`;
      answerPayload.answer = aiAnswer;
    }
  } catch (error) {
    answerPayload.modelError = error.message;
  }

  return answerPayload;
}
