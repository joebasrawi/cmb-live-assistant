const state = {
  sessions: [],
  currentSessionId: null,
  eventSource: null,
  transcript: [],
  alerts: [],
  notes: [],
  references: [],
  daisMode: localStorage.getItem("cmb-dais-mode") === "true",
  staticMode: false,
  staticTimer: null
};

const STATIC_RECORDS = [
  {
    id: "demo-ocean-drive-support-2024",
    title: "Demo prior statement: Ocean Drive operating restrictions",
    meetingDate: "2024-03-13",
    agendaItem: "R7B",
    person: "Commissioner",
    topic: "Ocean Drive",
    stance: "support",
    claim: "Supported a limited Ocean Drive operating restriction pilot after asking staff to return with enforcement details.",
    sourceUrl: "local://demo/prior-meetings/ocean-drive-support"
  },
  {
    id: "demo-ocean-drive-prior-discussion-2024",
    title: "Demo prior discussion: Ocean Drive policy was previously discussed",
    meetingDate: "2024-03-13",
    agendaItem: "R7B",
    person: "City Manager",
    topic: "Ocean Drive",
    stance: "prior-discussion",
    claim: "Administration presented prior Ocean Drive operational options and said a follow-up item would return to Commission.",
    sourceUrl: "local://demo/prior-meetings/ocean-drive-discussion"
  },
  {
    id: "demo-budget-fiscal-impact-2025",
    title: "Demo fiscal record: budget amendment was previously required",
    meetingDate: "2025-06-25",
    agendaItem: "C7A",
    person: "Budget Director",
    topic: "budget",
    stance: "fiscal-impact",
    claim: "Staff identified a fiscal impact and said a budget amendment would be needed before implementation.",
    sourceUrl: "local://demo/prior-meetings/budget-amendment"
  },
  {
    id: "demo-procurement-rfp-2025",
    title: "Demo procurement record: item tied to RFP path",
    meetingDate: "2025-09-17",
    agendaItem: "C4E",
    person: "Procurement Director",
    topic: "procurement",
    stance: "procurement",
    claim: "Staff said the contract path was tied to an RFP and would return with award recommendation details.",
    sourceUrl: "local://demo/prior-meetings/procurement-rfp"
  }
];

const STATIC_DEMO_LINES = [
  { speaker: "Mayor", text: "We are now moving to R7B. Can staff remind us what the prior LTC said about Ocean Drive operations?" },
  { speaker: "Commissioner", text: "I have always opposed Ocean Drive restrictions, and I do not think this has ever come before us." },
  { speaker: "City Manager", text: "This has no fiscal impact and should not require a budget amendment." },
  { speaker: "Commissioner", text: "Before we vote, I do not believe this was tied to an RFP or any procurement process." }
];

const elements = {
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  daisModeBtn: document.querySelector("#daisModeBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  sessionSelect: document.querySelector("#sessionSelect"),
  startDemoBtn: document.querySelector("#startDemoBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  manualText: document.querySelector("#manualText"),
  sendLineBtn: document.querySelector("#sendLineBtn"),
  sourceUrl: document.querySelector("#sourceUrl"),
  alertsList: document.querySelector("#alertsList"),
  transcriptList: document.querySelector("#transcriptList"),
  notesList: document.querySelector("#notesList"),
  referenceList: document.querySelector("#referenceList"),
  alertCount: document.querySelector("#alertCount"),
  transcriptCount: document.querySelector("#transcriptCount"),
  noteCount: document.querySelector("#noteCount"),
  referenceCount: document.querySelector("#referenceCount"),
  recordCount: document.querySelector("#recordCount")
};

function setStatus(text, mode = "idle") {
  elements.statusText.textContent = text;
  elements.statusDot.classList.toggle("live", mode === "live");
  elements.statusDot.classList.toggle("error", mode === "error");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function staticSession() {
  return {
    id: "static-demo",
    title: "CMB Commission live room",
    sourceUrl: "https://www.youtube.com/cityofmiamibeach",
    status: state.staticTimer ? "live" : "idle",
    transcript: state.transcript,
    alerts: state.alerts,
    notes: state.notes,
    references: state.references
  };
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function renderSessions(defaultSessionId) {
  elements.sessionSelect.innerHTML = "";
  for (const session of state.sessions) {
    const option = document.createElement("option");
    option.value = session.id;
    option.textContent = session.title;
    elements.sessionSelect.append(option);
  }
  state.currentSessionId = state.currentSessionId || defaultSessionId || state.sessions[0]?.id;
  elements.sessionSelect.value = state.currentSessionId;
}

function renderSnapshot(session) {
  state.transcript = session.transcript || [];
  state.alerts = session.alerts || [];
  state.notes = session.notes || [];
  state.references = session.references || [];
  elements.sourceUrl.href = session.sourceUrl;
  elements.sourceUrl.textContent = session.sourceUrl;
  setStatus(session.status === "live" ? "Live" : "Idle", session.status === "live" ? "live" : "idle");
  renderAlerts();
  renderTranscript();
  renderNotes();
  renderReferences();
}

function renderAlerts() {
  elements.alertCount.textContent = `${state.alerts.length} alert${state.alerts.length === 1 ? "" : "s"}`;
  elements.alertsList.innerHTML = "";
  if (!state.alerts.length) {
    elements.alertsList.append(emptyState("Proactive alerts will appear here when the live discussion differs from prior records or needs a vote-time context check."));
    return;
  }

  const priorityRank = { high: 3, medium: 2, low: 1 };
  const sortedAlerts = [...state.alerts].sort((a, b) => {
    const rankDelta = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    if (rankDelta) return rankDelta;
    return new Date(b.at) - new Date(a.at);
  });

  for (const alert of sortedAlerts) {
    const item = document.createElement("article");
    item.className = `alert-item priority-${escapeClass(alert.priority)}`;
    const evidence = (alert.evidence || []).map(renderEvidence).join("");
    item.innerHTML = `
      <div class="alert-topline">
        <span class="priority-pill">${escapeHtml(alert.priority || "medium")}</span>
        <span>${formatTime(alert.at)}</span>
      </div>
      <h3>${escapeHtml(alert.title)}</h3>
      <p>${escapeHtml(alert.body)}</p>
      <div class="recommendation">${escapeHtml(alert.recommendation || "")}</div>
      <div class="evidence-list">${evidence}</div>
    `;
    elements.alertsList.append(item);
  }
}

function renderEvidence(source) {
  const label = [source.meetingDate, source.agendaItem, source.person].filter(Boolean).join(" | ");
  const title = source.title || source.claim || "Prior record";
  const href = source.sourceUrl || "#";
  const link = isHttpUrl(href)
    ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
    : `<span>${escapeHtml(title)}</span>`;
  return `
    <div class="evidence-item">
      <div class="evidence-label">${escapeHtml(label || "Source memory")}</div>
      ${link}
      <p>${escapeHtml(source.claim || source.evidence || "")}</p>
    </div>
  `;
}

function renderTranscript() {
  elements.transcriptCount.textContent = `${state.transcript.length} line${state.transcript.length === 1 ? "" : "s"}`;
  elements.transcriptList.innerHTML = "";
  if (!state.transcript.length) {
    elements.transcriptList.append(emptyState("Transcript lines will appear here as the meeting audio is processed."));
    return;
  }

  for (const line of [...state.transcript].reverse()) {
    const item = document.createElement("article");
    item.className = "transcript-line";
    item.innerHTML = `
      <div class="line-meta">
        <span class="speaker">${escapeHtml(line.speaker)}</span>
        <span>${formatTime(line.at)}</span>
      </div>
      <p class="line-text">${escapeHtml(line.text)}</p>
    `;
    elements.transcriptList.append(item);
  }
}

function renderNotes() {
  elements.noteCount.textContent = `${state.notes.length} note${state.notes.length === 1 ? "" : "s"}`;
  elements.notesList.innerHTML = "";
  if (!state.notes.length) {
    elements.notesList.append(emptyState("Source-backed notes appear as agenda items and record mentions are detected."));
    return;
  }

  for (const note of [...state.notes].reverse()) {
    const item = document.createElement("article");
    item.className = `note-item ${note.confidence === "needs-review" ? "needs-review" : ""}`;
    const sources = (note.sources || []).map((source) => {
      if (!isHttpUrl(source.sourceUrl)) return `<span class="source-link">${escapeHtml(source.title)}</span>`;
      return `<a class="source-link" href="${escapeAttribute(source.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a>`;
    }).join("");
    item.innerHTML = `
      <div class="note-meta"><span>${escapeHtml(note.confidence)}</span><span>${formatTime(note.at)}</span></div>
      <p class="note-title">${escapeHtml(note.title)}</p>
      <p class="note-body">${escapeHtml(note.body)}</p>
      ${sources}
    `;
    elements.notesList.append(item);
  }
}

function renderReferences() {
  elements.referenceCount.textContent = `${state.references.length} ref${state.references.length === 1 ? "" : "s"}`;
  elements.referenceList.innerHTML = "";
  if (!state.references.length) {
    elements.referenceList.append(emptyState("Detected agenda items, LTCs, resolutions, ordinances, and policy topics collect here."));
    return;
  }

  for (const reference of [...state.references].reverse()) {
    const item = document.createElement("article");
    item.className = "reference-item";
    const results = (reference.results || []).map((source) => {
      if (!isHttpUrl(source.sourceUrl)) return `<span class="source-link">${escapeHtml(source.title)}</span>`;
      return `<a class="source-link" href="${escapeAttribute(source.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a>`;
    }).join("");
    item.innerHTML = `
      <span class="reference-pill">${escapeHtml(reference.type)} | ${escapeHtml(reference.confidence)}</span>
      <strong>${escapeHtml(reference.value)}</strong>
      ${results || `<span class="counter">No local source match yet</span>`}
    `;
    elements.referenceList.append(item);
  }
}

function emptyState(text) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.textContent = text;
  return node;
}

function connectEvents() {
  if (state.staticMode) {
    renderSnapshot(staticSession());
    return;
  }
  if (!state.currentSessionId) return;
  if (state.eventSource) state.eventSource.close();

  state.eventSource = new EventSource(`/api/sessions/${state.currentSessionId}/events`);

  state.eventSource.addEventListener("snapshot", (event) => {
    renderSnapshot(JSON.parse(event.data));
  });

  state.eventSource.addEventListener("transcript", (event) => {
    state.transcript.push(JSON.parse(event.data));
    renderTranscript();
  });

  state.eventSource.addEventListener("alerts", (event) => {
    state.alerts.push(...JSON.parse(event.data));
    renderAlerts();
  });

  state.eventSource.addEventListener("note", (event) => {
    state.notes.push(JSON.parse(event.data));
    renderNotes();
  });

  state.eventSource.addEventListener("references", (event) => {
    state.references.push(...JSON.parse(event.data));
    renderReferences();
  });

  state.eventSource.addEventListener("status", (event) => {
    const status = JSON.parse(event.data).status;
    setStatus(status === "live" ? "Live" : "Idle", status === "live" ? "live" : "idle");
  });

  state.eventSource.onerror = () => setStatus("Connection issue", "error");
}

async function loadSessions() {
  try {
    const [sessionsPayload, recordsPayload] = await Promise.all([
      api("/api/sessions"),
      api("/api/records")
    ]);
    state.staticMode = false;
    state.sessions = sessionsPayload.sessions;
    elements.recordCount.textContent = `${recordsPayload.records.length} prior record${recordsPayload.records.length === 1 ? "" : "s"}`;
    renderSessions(sessionsPayload.defaultSessionId);
    connectEvents();
  } catch {
    startStaticMode();
  }
}

async function startDemo() {
  if (state.staticMode) {
    startStaticDemo();
    return;
  }
  await api(`/api/sessions/${state.currentSessionId}/start-demo`, { method: "POST", body: "{}" });
}

async function stopSession() {
  if (state.staticMode) {
    stopStaticDemo();
    return;
  }
  await api(`/api/sessions/${state.currentSessionId}/stop`, { method: "POST", body: "{}" });
}

async function sendManualLine() {
  const text = elements.manualText.value.trim();
  if (!text) return;
  if (state.staticMode) {
    addStaticTranscript({ speaker: "Manual", text });
    elements.manualText.value = "";
    return;
  }
  await api(`/api/sessions/${state.currentSessionId}/transcript`, {
    method: "POST",
    body: JSON.stringify({ speaker: "Manual", text, isFinal: true })
  });
  elements.manualText.value = "";
}

function startStaticMode() {
  state.staticMode = true;
  state.sessions = [staticSession()];
  state.currentSessionId = "static-demo";
  elements.recordCount.textContent = `${STATIC_RECORDS.length} demo prior records`;
  renderSessions("static-demo");
  setStatus("Demo", "idle");
  renderSnapshot(staticSession());
}

function startStaticDemo() {
  stopStaticDemo();
  let index = 0;
  setStatus("Live demo", "live");
  state.staticTimer = setInterval(() => {
    addStaticTranscript(STATIC_DEMO_LINES[index % STATIC_DEMO_LINES.length]);
    index += 1;
  }, 2200);
}

function stopStaticDemo() {
  if (state.staticTimer) clearInterval(state.staticTimer);
  state.staticTimer = null;
  setStatus("Demo", "idle");
}

function addStaticTranscript({ speaker = "Unknown", text }) {
  const segment = {
    id: crypto.randomUUID(),
    speaker,
    text,
    isFinal: true,
    at: new Date().toISOString()
  };
  state.transcript.push(segment);

  const references = detectStaticReferences(text);
  if (references.length) {
    state.references.push(...references);
    state.notes.push(createStaticNote(segment, references));
  }

  const alerts = createStaticAlerts(segment, references);
  state.alerts.push(...alerts);
  renderSnapshot(staticSession());
}

function detectStaticReferences(text) {
  const refs = [];
  const lower = text.toLowerCase();
  const agendaMatches = text.match(/\b(?:R|C|NB|PA|PH|SM)\d{1,2}[A-Z]?\b/gi) || [];
  for (const value of agendaMatches) refs.push(reference("agenda-item", value, "high"));
  if (/\bltc\b/i.test(text)) refs.push(reference("ltc", "LTC", "medium"));
  if (lower.includes("ocean drive")) refs.push(reference("topic", "Ocean Drive", "medium"));
  if (lower.includes("budget") || lower.includes("fiscal impact")) refs.push(reference("topic", "budget", "medium"));
  if (lower.includes("rfp") || lower.includes("procurement")) refs.push(reference("topic", "procurement", "medium"));
  return refs;
}

function reference(type, value, confidence) {
  return {
    id: crypto.randomUUID(),
    type,
    value,
    confidence,
    at: new Date().toISOString(),
    results: STATIC_RECORDS.filter((record) => record.topic === value || record.agendaItem === value).slice(0, 3)
  };
}

function createStaticNote(segment, references) {
  const sources = references.flatMap((item) => item.results || []);
  const uniqueSources = [...new Map(sources.map((source) => [source.id, source])).values()];
  return {
    id: crypto.randomUUID(),
    at: segment.at,
    title: `Reference detected: ${references.map((item) => item.value).join(", ")}`,
    body: `${uniqueSources.length || "No"} related source${uniqueSources.length === 1 ? "" : "s"} found. Verify against the current agenda packet before treating this as final.`,
    confidence: uniqueSources.length ? "source-assisted" : "needs-review",
    sources: uniqueSources
  };
}

function createStaticAlerts(segment, references) {
  const text = segment.text.toLowerCase();
  const alerts = [];
  if (text.includes("opposed ocean drive") || text.includes("never come before")) {
    alerts.push(staticAlert("high", "Possible inconsistency on Ocean Drive", "The live statement sounds like opposition or no prior record, but demo prior memory points the other way.", "Use this as a source-backed prompt: ask staff to confirm the prior record before relying on the live statement.", STATIC_RECORDS.filter((record) => record.topic === "Ocean Drive"), segment));
  }
  if (text.includes("no fiscal impact")) {
    alerts.push(staticAlert("high", "Possible inconsistency on budget", "The live statement sounds like no fiscal impact, but demo prior memory says a budget amendment was previously required.", "Ask staff to confirm fiscal impact and whether a budget amendment is needed.", STATIC_RECORDS.filter((record) => record.topic === "budget"), segment));
  }
  if (text.includes("rfp") && (text.includes("not") || text.includes("do not believe"))) {
    alerts.push(staticAlert("high", "Possible inconsistency on procurement", "The live statement sounds like no procurement tie, but demo prior memory says this was tied to an RFP path.", "Ask staff to confirm the procurement path before the motion is finalized.", STATIC_RECORDS.filter((record) => record.topic === "procurement"), segment));
  }
  if (text.includes("before we vote") || text.includes("motion")) {
    alerts.push(staticAlert("medium", "Vote-time context check", "A vote or motion may be imminent. The assistant pulled related prior records for a quick dais check.", "Confirm item title, fiscal impact, procurement path, sponsor, and any prior vote before the motion is finalized.", STATIC_RECORDS.filter((record) => references.some((ref) => ref.value === record.topic || ref.value === record.agendaItem)), segment));
  }
  return alerts;
}

function staticAlert(priority, title, body, recommendation, evidence, segment) {
  return {
    id: crypto.randomUUID(),
    type: priority === "high" ? "possible-contradiction" : "decision-support",
    priority,
    at: segment.at,
    title,
    body,
    recommendation,
    triggerText: segment.text,
    evidence
  };
}

function setDaisMode(enabled) {
  state.daisMode = enabled;
  document.body.classList.toggle("dais-mode", enabled);
  elements.daisModeBtn.textContent = enabled ? "Exit Dais Mode" : "Dais Mode";
  localStorage.setItem("cmb-dais-mode", String(enabled));
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeClass(value) {
  return String(value || "medium").replace(/[^a-z0-9_-]/gi, "");
}

elements.refreshBtn.addEventListener("click", loadSessions);
elements.startDemoBtn.addEventListener("click", startDemo);
elements.stopBtn.addEventListener("click", stopSession);
elements.sendLineBtn.addEventListener("click", sendManualLine);
elements.daisModeBtn.addEventListener("click", () => setDaisMode(!state.daisMode));
elements.sessionSelect.addEventListener("change", () => {
  state.currentSessionId = elements.sessionSelect.value;
  connectEvents();
});

setDaisMode(state.daisMode);
loadSessions().catch((error) => {
  setStatus(error.message, "error");
});
