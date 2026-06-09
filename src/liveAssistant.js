import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { detectReferences } from "./referenceDetector.js";

const DEMO_LINES = [
  { speaker: "Mayor Steven Meiner", text: "We are now moving to R7B. Can staff remind us what the prior LTC said about Ocean Drive operations?" },
  { speaker: "Commissioner Tanya K. Bhatt", text: "I have always opposed Ocean Drive restrictions, and I do not think this has ever come before us." },
  { speaker: "City Manager Eric Carpenter", text: "This has no fiscal impact and should not require a budget amendment." },
  { speaker: "Commissioner David Suarez", text: "Before we vote, I do not believe this was tied to an RFP or any procurement process." },
  { speaker: "City Attorney Ricardo J. Dopico", text: "The ordinance language is separate from the resolution before you today." },
  { speaker: "Public Speaker", text: "Please also consider the traffic and parking impacts on residents." }
];

function normalizeSourceUrl(sourceUrl) {
  const value = String(sourceUrl || "").trim();
  if (
    /youtube\.com\/c\/CityofMiamiBeachTV\/live/i.test(value) ||
    /youtube\.com\/@cityofmiamibeach\/live/i.test(value)
  ) {
    return "https://www.youtube.com/cityofmiamibeach";
  }
  return value;
}

export class LiveAssistant {
  constructor({ memoryStore, proactiveWatcher, rootDir }) {
    this.memoryStore = memoryStore;
    this.proactiveWatcher = proactiveWatcher;
    this.rootDir = rootDir;
    this.sessions = new Map();
    this.clients = new Map();
    this.demoTimers = new Map();
  }

  listSessions() {
    return [...this.sessions.values()].map((session) => this.publicSession(session));
  }

  createSession({ title, sourceUrl } = {}) {
    const now = new Date().toISOString();
    const session = {
      id: randomUUID(),
      title: title || "City of Miami Beach live meeting",
      sourceUrl: normalizeSourceUrl(sourceUrl || process.env.CMB_DEFAULT_LIVE_URL || "https://www.youtube.com/cityofmiamibeach"),
      status: "idle",
      createdAt: now,
      updatedAt: now,
      transcript: [],
      alerts: [],
      notes: [],
      cards: [],
      dismissedAlertIds: [],
      references: []
    };
    this.sessions.set(session.id, session);
    this.clients.set(session.id, new Set());
    return this.publicSession(session);
  }

  getSession(id) {
    const session = this.sessions.get(id);
    return session ? this.publicSession(session) : null;
  }

  setSessionStatus(id, status, { sourceUrl } = {}) {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.status = status;
    if (sourceUrl) session.sourceUrl = normalizeSourceUrl(sourceUrl);
    session.updatedAt = new Date().toISOString();
    this.broadcast(id, "status", { status: session.status });
    this.broadcast(id, "snapshot", this.publicSession(session));
    return this.publicSession(session);
  }

  publicSession(session) {
    return {
      id: session.id,
      title: session.title,
      sourceUrl: session.sourceUrl,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      transcript: session.transcript.slice(-80),
      alerts: session.alerts.slice(-40),
      notes: session.notes.slice(-40),
      cards: session.cards.slice(-20),
      dismissedAlertIds: (session.dismissedAlertIds || []).slice(-80),
      references: session.references.slice(-40)
    };
  }

  subscribe(sessionId, response) {
    const clients = this.clients.get(sessionId);
    if (!clients) return false;
    clients.add(response);
    this.send(response, "snapshot", this.getSession(sessionId));
    return true;
  }

  unsubscribe(sessionId, response) {
    this.clients.get(sessionId)?.delete(response);
  }

  broadcast(sessionId, event, payload) {
    const clients = this.clients.get(sessionId) || new Set();
    for (const client of clients) {
      this.send(client, event, payload);
    }
  }

  send(response, event, payload) {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  async addTranscript(sessionId, { speaker = "Unknown", text, isFinal = true, at = new Date().toISOString() }) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const segment = {
      id: randomUUID(),
      speaker,
      text: String(text || "").trim(),
      isFinal: Boolean(isFinal),
      at
    };

    if (!segment.text) return this.publicSession(session);

    session.status = "live";
    session.updatedAt = at;
    session.transcript.push(segment);
    this.broadcast(sessionId, "transcript", segment);

    const detected = detectReferences(segment.text);
    const enrichedReferences = detected.map((reference) => ({
      ...reference,
      id: randomUUID(),
      at,
      query: reference.value,
      results: this.memoryStore.search(reference.value, { limit: 4 })
    }));

    if (enrichedReferences.length) {
      session.references.push(...enrichedReferences);
      this.broadcast(sessionId, "references", enrichedReferences);
    }

    const alerts = this.proactiveWatcher.analyze({ segment, references: enrichedReferences });
    if (alerts.length) {
      session.alerts.push(...alerts);
      this.broadcast(sessionId, "alerts", alerts);
    }

    const note = this.createNote(segment, enrichedReferences);
    if (note) {
      session.notes.push(note);
      this.broadcast(sessionId, "note", note);
    }

    await this.persistEvent(sessionId, {
      type: "transcript",
      segment,
      references: enrichedReferences,
      alerts,
      note
    });

    return this.publicSession(session);
  }

  pushCard(sessionId, { title, body, recommendation, evidence = [], priority = "medium", source = "aide", createdBy = "Aide" }) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const card = {
      id: randomUUID(),
      type: "aide-card",
      priority,
      confidence: "aide-reviewed",
      confidenceLabel: "Aide reviewed",
      reviewStatus: "approved",
      audience: "commissioner",
      why: "An aide reviewed this item and sent it to the commissioner.",
      sourceCount: Array.isArray(evidence) ? evidence.length : 0,
      at: new Date().toISOString(),
      title: String(title || "Aide note").trim(),
      body: String(body || "").trim(),
      recommendation: String(recommendation || "").trim(),
      evidence: Array.isArray(evidence) ? evidence.slice(0, 5) : [],
      source,
      createdBy
    };

    session.cards.push(card);
    session.alerts.push(card);
    session.updatedAt = card.at;
    this.broadcast(sessionId, "cards", [card]);
    this.broadcast(sessionId, "alerts", [card]);
    this.broadcast(sessionId, "snapshot", this.publicSession(session));
    return this.publicSession(session);
  }

  reviewAlert(sessionId, { alertId, action, createdBy = "Aide", note = "" }) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const alert = session.alerts.find((item) => item.id === alertId);
    if (!alert) return this.publicSession(session);

    if (action === "dismiss") {
      alert.reviewStatus = "dismissed";
      alert.reviewedBy = createdBy;
      alert.reviewedAt = new Date().toISOString();
      if (!session.dismissedAlertIds.includes(alertId)) session.dismissedAlertIds.push(alertId);
      session.updatedAt = alert.reviewedAt;
      this.broadcast(sessionId, "snapshot", this.publicSession(session));
      return this.publicSession(session);
    }

    this.pushCard(sessionId, {
      title: alert.title,
      body: note ? `${alert.body}\n\nAide note: ${note}` : alert.body,
      recommendation: alert.recommendation,
      evidence: alert.evidence,
      priority: alert.priority,
      source: "reviewed-alert",
      createdBy
    });
    alert.reviewStatus = "sent";
    alert.reviewedBy = createdBy;
    alert.reviewedAt = new Date().toISOString();
    const snapshot = this.publicSession(session);
    this.broadcast(sessionId, "snapshot", snapshot);
    return snapshot;
  }

  createNote(segment, references) {
    if (!references.length) return null;

    const sourceMatches = references.flatMap((reference) => reference.results || []);
    const uniqueSources = [];
    const seen = new Set();
    for (const source of sourceMatches) {
      if (!seen.has(source.id)) {
        seen.add(source.id);
        uniqueSources.push(source);
      }
    }

    const referenceLabels = references.map((reference) => reference.value).join(", ");
    const sourceLabel = uniqueSources.length
      ? `${uniqueSources.length} related source${uniqueSources.length === 1 ? "" : "s"} found`
      : "No local source match yet";

    return {
      id: randomUUID(),
      at: segment.at,
      title: `Reference detected: ${referenceLabels}`,
      body: `${sourceLabel}. Verify against the current agenda packet before treating this as final.`,
      confidence: uniqueSources.length ? "source-assisted" : "needs-review",
      sources: uniqueSources.slice(0, 5)
    };
  }

  async persistEvent(sessionId, event) {
    const sessionsDir = path.join(this.rootDir, "data", "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.appendFile(
      path.join(sessionsDir, `${sessionId}.jsonl`),
      `${JSON.stringify({ ...event, writtenAt: new Date().toISOString() })}\n`,
      "utf8"
    );
  }

  startDemo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    this.stopDemo(sessionId);
    session.status = "live";
    this.broadcast(sessionId, "status", { status: session.status });

    let index = 0;
    const timer = setInterval(async () => {
      const line = DEMO_LINES[index % DEMO_LINES.length];
      await this.addTranscript(sessionId, line);
      index += 1;
    }, 2400);

    this.demoTimers.set(sessionId, timer);
    return this.publicSession(session);
  }

  stopDemo(sessionId) {
    const timer = this.demoTimers.get(sessionId);
    if (timer) clearInterval(timer);
    this.demoTimers.delete(sessionId);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "idle";
      session.updatedAt = new Date().toISOString();
      this.broadcast(sessionId, "status", { status: session.status });
      return this.publicSession(session);
    }
    return null;
  }
}
