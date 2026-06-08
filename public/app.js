const state = {
  sessions: [],
  currentSessionId: null,
  eventSource: null,
  transcript: [],
  alerts: [],
  notes: [],
  references: [],
  answers: [],
  sourceIndex: new Map(),
  daisMode: localStorage.getItem("cmb-dais-mode") === "true",
  staticMode: false,
  staticTimer: null
};

const OFFICIAL_SOURCES = [
  {
    id: "official-mayor-commission",
    title: "Official Mayor and Commission roster",
    kind: "official-roster",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    claim: "The City Commission consists of Mayor Steven Meiner and Commissioners Monica Matteo-Salinas, Laura Dominguez, Alex Fernandez, Tanya K. Bhatt, David Suarez, and Joseph Magazine."
  },
  {
    id: "official-city-manager",
    title: "Official City Manager team",
    kind: "official-roster",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-manager/",
    claim: "Eric Carpenter is listed by the city as City Manager. The page also lists Mark Taxis, Maria Hernandez, and David Martinez as Assistant City Managers."
  },
  {
    id: "official-city-clerk",
    title: "Official City Clerk and public records resources",
    kind: "official-source",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-clerk/",
    claim: "Rafael E. Granado is listed as City Clerk. The Clerk page links to meetings and agendas, LTCs, public records, resolutions, and ordinances."
  },
  {
    id: "official-meetings-agendas",
    title: "Official meetings, agendas, minutes, and video records",
    kind: "official-source",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-clerk/meetings-and-agendas/",
    claim: "This is the first official source for current and past agendas, minutes, agenda packets, and video records."
  },
  {
    id: "official-archived-meetings",
    title: "Official MBTV archived meetings",
    kind: "official-video-source",
    sourceUrl: "https://www.miamibeachfl.gov/mbtv/archived-meetings/",
    claim: "Official archived meeting videos are the source of record for timestamped live-meeting review."
  },
  {
    id: "official-ltc",
    title: "Letters to Commission (LTC)",
    kind: "official-record-index",
    sourceUrl: "https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=261613&dbid=0&repo=CityClerk",
    claim: "The City Clerk page links to Letters to Commission. LTCs are a key source for staff updates, policy implementation notes, and follow-up items."
  },
  {
    id: "official-resolutions-ordinances",
    title: "Resolutions and Ordinances",
    kind: "official-record-index",
    sourceUrl: "https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=2&dbid=0&repo=CityClerk",
    claim: "The City Clerk page links to resolutions and ordinances. Use this for adopted legislative record checks."
  }
];

const STATIC_RECORDS = [
  {
    id: "official-roster-steven-meiner",
    title: "Mayor Steven Meiner",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Steven Meiner",
    role: "Mayor",
    topic: "officials",
    stance: "record-exists",
    claim: "Steven Meiner is listed by the city as Mayor of Miami Beach.",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    sourceId: "official-mayor-commission"
  },
  {
    id: "official-roster-monica-matteo-salinas",
    title: "Commissioner Monica Matteo-Salinas, Group 1",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Monica Matteo-Salinas",
    role: "Commissioner Group 1",
    topic: "officials",
    stance: "record-exists",
    claim: "Monica Matteo-Salinas is listed by the city as Group 1 Commissioner.",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    sourceId: "official-mayor-commission"
  },
  {
    id: "official-roster-laura-dominguez",
    title: "Commissioner Laura Dominguez, Group 2",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Laura Dominguez",
    role: "Commissioner Group 2",
    topic: "officials",
    stance: "record-exists",
    claim: "Laura Dominguez is listed by the city as Group 2 Commissioner.",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    sourceId: "official-mayor-commission"
  },
  {
    id: "official-roster-alex-fernandez",
    title: "Commissioner Alex Fernandez, Group 3",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Alex Fernandez",
    role: "Commissioner Group 3",
    topic: "officials",
    stance: "record-exists",
    claim: "Alex Fernandez is listed by the city as Group 3 Commissioner.",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    sourceId: "official-mayor-commission"
  },
  {
    id: "official-roster-tanya-bhatt",
    title: "Commissioner Tanya K. Bhatt, Group 4",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Tanya K. Bhatt",
    role: "Commissioner Group 4",
    topic: "officials",
    stance: "record-exists",
    claim: "Tanya K. Bhatt is listed by the city as Group 4 Commissioner.",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    sourceId: "official-mayor-commission"
  },
  {
    id: "official-roster-david-suarez",
    title: "Commissioner David Suarez, Group 5",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "David Suarez",
    role: "Commissioner Group 5",
    topic: "officials",
    stance: "record-exists",
    claim: "David Suarez is listed by the city as Group 5 Commissioner.",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    sourceId: "official-mayor-commission"
  },
  {
    id: "official-roster-joseph-magazine",
    title: "Commissioner Joseph Magazine, Group 6",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Joseph Magazine",
    role: "Commissioner Group 6",
    topic: "officials",
    stance: "record-exists",
    claim: "Joseph Magazine is listed by the city as Group 6 Commissioner.",
    sourceUrl: "https://www.miamibeachfl.gov/egovapp/mayor-and-commissioners/",
    sourceId: "official-mayor-commission"
  },
  {
    id: "official-roster-eric-carpenter",
    title: "City Manager Eric Carpenter",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Eric Carpenter",
    role: "City Manager",
    topic: "administration",
    stance: "record-exists",
    claim: "Eric Carpenter is listed by the city as City Manager.",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-manager/",
    sourceId: "official-city-manager"
  },
  {
    id: "official-roster-rafael-granado",
    title: "City Clerk Rafael E. Granado",
    recordType: "official-roster",
    meetingDate: "2026-06-08",
    person: "Rafael E. Granado",
    role: "City Clerk",
    topic: "records",
    stance: "record-exists",
    claim: "Rafael E. Granado is listed by the city as City Clerk and official secretary for the City Commission.",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-clerk/",
    sourceId: "official-city-clerk"
  },
  {
    id: "demo-ocean-drive-tanya-bhatt-support-2024",
    title: "Demo prior statement: Tanya K. Bhatt on Ocean Drive operating restrictions",
    meetingDate: "2024-03-13",
    agendaItem: "R7B",
    person: "Tanya K. Bhatt",
    role: "Commissioner Group 4",
    topic: "Ocean Drive",
    stance: "support",
    claim: "Supported a limited Ocean Drive operating restriction pilot after asking staff to return with enforcement details.",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-clerk/meetings-and-agendas/",
    sourceId: "official-meetings-agendas"
  },
  {
    id: "demo-ocean-drive-eric-carpenter-prior-discussion-2024",
    title: "Demo prior discussion: Eric Carpenter on Ocean Drive follow-up",
    meetingDate: "2024-03-13",
    agendaItem: "R7B",
    person: "Eric Carpenter",
    role: "City Manager",
    topic: "Ocean Drive",
    stance: "prior-discussion",
    claim: "Administration presented prior Ocean Drive operational options and said a follow-up item would return to Commission.",
    sourceUrl: "https://www.miamibeachfl.gov/mbtv/archived-meetings/",
    sourceId: "official-archived-meetings"
  },
  {
    id: "demo-budget-jason-greene-fiscal-impact-2025",
    title: "Demo fiscal record: Jason Greene said budget amendment was required",
    meetingDate: "2025-06-25",
    agendaItem: "C7A",
    person: "Jason Greene",
    role: "Chief Financial Officer",
    topic: "budget",
    stance: "fiscal-impact",
    claim: "Staff identified a fiscal impact and said a budget amendment would be needed before implementation.",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-manager/",
    sourceId: "official-city-manager"
  },
  {
    id: "demo-procurement-david-suarez-rfp-2025",
    title: "Demo procurement record: David Suarez asked about RFP path",
    meetingDate: "2025-09-17",
    agendaItem: "C4E",
    person: "David Suarez",
    role: "Commissioner Group 5",
    topic: "procurement",
    stance: "procurement",
    claim: "Asked staff to confirm that the contract path was tied to an RFP and would return with award recommendation details.",
    sourceUrl: "https://www.miamibeachfl.gov/city-hall/city-clerk/meetings-and-agendas/",
    sourceId: "official-meetings-agendas"
  },
  {
    id: "official-records-ltc-index",
    title: "Letters to Commission index",
    recordType: "official-record-index",
    meetingDate: "2026-06-08",
    person: "Rafael E. Granado",
    role: "City Clerk",
    topic: "LTC",
    stance: "record-exists",
    claim: "Letters to Commission are a key city resource for staff updates, implementation status, and follow-up context.",
    sourceUrl: "https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=261613&dbid=0&repo=CityClerk",
    sourceId: "official-ltc"
  },
  {
    id: "official-records-resolutions-ordinances-index",
    title: "Resolutions and ordinances index",
    recordType: "official-record-index",
    meetingDate: "2026-06-08",
    person: "Rafael E. Granado",
    role: "City Clerk",
    topic: "legislation",
    stance: "record-exists",
    claim: "Resolutions and ordinances are the adopted legislative record for checking what the Commission actually approved.",
    sourceUrl: "https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=2&dbid=0&repo=CityClerk",
    sourceId: "official-resolutions-ordinances"
  }
];

const STATIC_DEMO_LINES = [
  { speaker: "Mayor Steven Meiner", text: "We are now moving to R7B. Can staff remind us what the prior LTC said about Ocean Drive operations?" },
  { speaker: "Commissioner Tanya K. Bhatt", text: "I have always opposed Ocean Drive restrictions, and I do not think this has ever come before us." },
  { speaker: "City Manager Eric Carpenter", text: "This has no fiscal impact and should not require a budget amendment." },
  { speaker: "Commissioner David Suarez", text: "Before we vote, I do not believe this was tied to an RFP or any procurement process." }
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
  askText: document.querySelector("#askText"),
  askBtn: document.querySelector("#askBtn"),
  sourceUrl: document.querySelector("#sourceUrl"),
  answersList: document.querySelector("#answersList"),
  alertsList: document.querySelector("#alertsList"),
  transcriptList: document.querySelector("#transcriptList"),
  notesList: document.querySelector("#notesList"),
  referenceList: document.querySelector("#referenceList"),
  answerCount: document.querySelector("#answerCount"),
  alertCount: document.querySelector("#alertCount"),
  transcriptCount: document.querySelector("#transcriptCount"),
  noteCount: document.querySelector("#noteCount"),
  referenceCount: document.querySelector("#referenceCount"),
  recordCount: document.querySelector("#recordCount"),
  sourceModal: document.querySelector("#sourceModal"),
  sourceModalTitle: document.querySelector("#sourceModalTitle"),
  sourceModalBody: document.querySelector("#sourceModalBody"),
  closeSourceBtn: document.querySelector("#closeSourceBtn")
};

function rebuildSourceIndex() {
  state.sourceIndex.clear();
  for (const source of OFFICIAL_SOURCES) state.sourceIndex.set(source.id, source);
  for (const record of STATIC_RECORDS) state.sourceIndex.set(record.id, record);
}

function indexSources(sources = []) {
  for (const source of sources) {
    if (source?.id) state.sourceIndex.set(source.id, source);
    if (source?.sourceId && !state.sourceIndex.has(source.sourceId)) {
      const officialSource = OFFICIAL_SOURCES.find((item) => item.id === source.sourceId);
      if (officialSource) state.sourceIndex.set(officialSource.id, officialSource);
    }
  }
}

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
  renderAnswers();
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
    indexSources(alert.evidence);
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

function renderAnswers() {
  elements.answerCount.textContent = `${state.answers.length} answer${state.answers.length === 1 ? "" : "s"}`;
  elements.answersList.innerHTML = "";
  if (!state.answers.length) {
    elements.answersList.append(emptyState("Ask about a person, topic, agenda item, vote, LTC, procurement path, fiscal impact, or possible inconsistency."));
    return;
  }

  for (const answer of [...state.answers].reverse()) {
    indexSources(answer.evidence);
    const item = document.createElement("article");
    item.className = "answer-item";
    item.innerHTML = `
      <div class="answer-topline">
        <span>${escapeHtml(answer.mode)}</span>
        <span>${formatTime(answer.at)}</span>
      </div>
      <h3>${escapeHtml(answer.question)}</h3>
      <p>${escapeHtml(answer.answer)}</p>
      <div class="recommendation">${escapeHtml(answer.recommendation)}</div>
      <div class="evidence-list">${answer.evidence.map(renderEvidence).join("")}</div>
    `;
    elements.answersList.append(item);
  }
}

function renderEvidence(source) {
  if (source?.id) state.sourceIndex.set(source.id, source);
  const label = [source.meetingDate, source.agendaItem, source.person].filter(Boolean).join(" | ");
  const title = source.title || source.claim || "Prior record";
  const href = source.sourceUrl || "#";
  const sourceId = source.id || source.sourceId || "";
  const officialSource = OFFICIAL_SOURCES.find((item) => item.id === source.sourceId);
  return `
    <div class="evidence-item">
      <div class="evidence-label">${escapeHtml(label || "Source memory")}</div>
      <button class="source-button" data-source-id="${escapeAttribute(sourceId)}">${escapeHtml(title)}</button>
      <p>${escapeHtml(source.claim || source.evidence || "")}</p>
      ${officialSource ? `<a class="source-link" href="${escapeAttribute(officialSource.sourceUrl)}" target="_blank" rel="noreferrer">Open official source</a>` : ""}
      ${isHttpUrl(href) ? `<a class="source-link" href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">Open referenced page</a>` : ""}
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
    indexSources(note.sources);
    const item = document.createElement("article");
    item.className = `note-item ${note.confidence === "needs-review" ? "needs-review" : ""}`;
    const sources = (note.sources || []).map(renderSourceChip).join("");
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
    indexSources(reference.results);
    const item = document.createElement("article");
    item.className = "reference-item";
    const results = (reference.results || []).map(renderSourceChip).join("");
    item.innerHTML = `
      <span class="reference-pill">${escapeHtml(reference.type)} | ${escapeHtml(reference.confidence)}</span>
      <strong>${escapeHtml(reference.value)}</strong>
      ${results || `<span class="counter">No local source match yet</span>`}
    `;
    elements.referenceList.append(item);
  }
}

function renderSourceChip(source) {
  if (source?.id) state.sourceIndex.set(source.id, source);
  const sourceId = source.id || source.sourceId || "";
  return `<button class="source-chip" data-source-id="${escapeAttribute(sourceId)}">${escapeHtml(source.title || source.claim || "Source")}</button>`;
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
    indexSources(recordsPayload.records);
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

async function askStaffer() {
  const question = elements.askText.value.trim();
  if (!question) return;
  let answer;
  if (!state.staticMode) {
    try {
      const payload = await api("/api/ask", {
        method: "POST",
        body: JSON.stringify({ question })
      });
      answer = payload.answer;
    } catch {
      answer = answerQuestion(question);
    }
  } else {
    answer = answerQuestion(question);
  }
  indexSources(answer.evidence);
  state.answers.push(answer);
  elements.askText.value = "";
  renderAnswers();
}

function answerQuestion(question) {
  const matches = searchStaticMemory(question, { limit: 6 });
  const person = detectPerson(question);
  const topic = detectTopic(question);
  const asksInconsistency = /inconsistent|contradict|different|before|previous|prior|said/i.test(question);

  let answer = "I found related source records in the city memory seed. Treat this as a lead until the official meeting record is opened.";
  let recommendation = "Open the evidence cards, then verify the official agenda packet, LTC, resolution, ordinance, or archived video before using it on the dais.";
  let mode = "Source pull";

  if (person && topic && asksInconsistency) {
    mode = "Consistency check";
    answer = `${person} has related memory on ${topic}. The current demo memory can identify possible differences, but a final consistency call needs the official transcript or video timestamp.`;
    recommendation = `Ask staff to confirm ${person}'s prior ${topic} statements using the official source cards below.`;
  } else if (person) {
    mode = "Person lookup";
    answer = `I found records tied to ${person}. The strongest matches are shown below.`;
    recommendation = "Use the official roster source for identity/role and the meeting records for any substantive claim.";
  } else if (topic) {
    mode = "Topic lookup";
    answer = `I found records and official source indexes for ${topic}.`;
    recommendation = "Open the city index most relevant to the question: agendas for meeting items, LTCs for staff updates, and resolutions/ordinances for adopted action.";
  }

  const evidence = matches.length ? matches : OFFICIAL_SOURCES.slice(0, 4);
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    question,
    mode,
    answer,
    recommendation,
    evidence
  };
}

function searchStaticMemory(query, { limit = 8 } = {}) {
  const tokens = tokenize(query);
  const people = detectPeople(query);
  const topic = detectTopic(query);
  const haystack = [...STATIC_RECORDS, ...OFFICIAL_SOURCES];

  return haystack
    .map((record) => ({ ...record, score: scoreRecord(record, tokens, people, topic) }))
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function scoreRecord(record, tokens, people, topic) {
  const text = [
    record.title,
    record.kind,
    record.recordType,
    record.person,
    record.role,
    record.topic,
    record.stance,
    record.claim,
    record.agendaItem
  ].join(" ").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) score += 1;
  }
  if (topic && String(record.topic || "").toLowerCase() === topic.toLowerCase()) score += 5;
  for (const person of people) {
    if (`${record.person || ""} ${record.role || ""}`.toLowerCase().includes(person.toLowerCase())) score += 6;
  }
  if (/ltc/i.test(tokens.join(" ")) && /ltc/i.test(`${record.title} ${record.topic} ${record.claim}`)) score += 4;
  if (/resolution|ordinance|legislation/i.test(tokens.join(" ")) && /resolution|ordinance|legislation/i.test(`${record.title} ${record.topic} ${record.claim}`)) score += 4;
  return score;
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function detectPeople(text) {
  const lower = text.toLowerCase();
  const people = [
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
  return people.filter((person) => {
    const variants = [person, person.replace("K. ", ""), person.split(" ").at(-1)].map((item) => item.toLowerCase());
    return variants.some((variant) => variant && lower.includes(variant));
  });
}

function detectPerson(text) {
  return detectPeople(text)[0] || "";
}

function detectTopic(text) {
  const lower = text.toLowerCase();
  const rules = [
    ["Ocean Drive", ["ocean drive", "lummus", "art deco"]],
    ["budget", ["budget", "fiscal", "appropriation", "millage"]],
    ["procurement", ["procurement", "rfp", "rfq", "bid", "contract"]],
    ["LTC", ["ltc", "letter to commission"]],
    ["legislation", ["resolution", "ordinance", "legislation"]],
    ["transportation", ["parking", "traffic", "mobility", "transit"]],
    ["officials", ["mayor", "commissioner", "city manager", "city clerk"]]
  ];
  return rules.find(([, needles]) => needles.some((needle) => lower.includes(needle)))?.[0] || "";
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
  for (const person of detectPeople(text)) refs.push(reference("person", person, "high"));
  if (/\bltc\b/i.test(text)) refs.push(reference("ltc", "LTC", "medium"));
  if (/resolution|ordinance/i.test(text)) refs.push(reference("legislation", "legislation", "medium"));
  if (lower.includes("ocean drive")) refs.push(reference("topic", "Ocean Drive", "medium"));
  if (lower.includes("budget") || lower.includes("fiscal impact")) refs.push(reference("topic", "budget", "medium"));
  if (lower.includes("rfp") || lower.includes("procurement")) refs.push(reference("topic", "procurement", "medium"));
  return refs;
}

function reference(type, value, confidence) {
  const exactResults = STATIC_RECORDS.filter((record) => {
    const recordPerson = String(record.person || "").toLowerCase();
    return record.topic === value || record.agendaItem === value || recordPerson.includes(String(value).toLowerCase());
  });
  const searchResults = searchStaticMemory(`${type} ${value}`, { limit: 4 });
  const results = [...new Map([...exactResults, ...searchResults].map((record) => [record.id, record])).values()].slice(0, 4);
  return {
    id: crypto.randomUUID(),
    type,
    value,
    confidence,
    at: new Date().toISOString(),
    results
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
    alerts.push(staticAlert("high", "Possible inconsistency: Tanya K. Bhatt / Ocean Drive", "The live statement sounds like opposition or no prior record, but demo prior memory has Tanya K. Bhatt supporting a limited Ocean Drive restriction pilot and the City Manager discussing follow-up.", "Open the source cards, then ask staff to confirm the prior Ocean Drive record before relying on the live statement.", STATIC_RECORDS.filter((record) => record.topic === "Ocean Drive"), segment));
  }
  if (text.includes("no fiscal impact")) {
    alerts.push(staticAlert("high", "Possible inconsistency: Eric Carpenter / budget impact", "The live statement sounds like no fiscal impact, but demo prior memory says staff previously identified a budget amendment requirement.", "Ask the City Manager or CFO to confirm fiscal impact and whether a budget amendment is needed.", STATIC_RECORDS.filter((record) => record.topic === "budget"), segment));
  }
  if (text.includes("rfp") && (text.includes("not") || text.includes("do not believe"))) {
    alerts.push(staticAlert("high", "Possible inconsistency: David Suarez / procurement path", "The live statement sounds like no procurement tie, but demo prior memory has David Suarez asking staff to confirm the RFP path.", "Ask Procurement or the City Attorney to confirm the procurement path before the motion is finalized.", STATIC_RECORDS.filter((record) => record.topic === "procurement"), segment));
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

function openSourceModal(sourceId) {
  const source = state.sourceIndex.get(sourceId);
  if (!source) return;
  const officialSource = source.sourceId ? state.sourceIndex.get(source.sourceId) : null;
  elements.sourceModalTitle.textContent = source.title || source.claim || "Source";
  elements.sourceModalBody.innerHTML = `
    <div class="source-detail-grid">
      ${detailRow("Person", source.person)}
      ${detailRow("Role", source.role)}
      ${detailRow("Date", source.meetingDate || source.date)}
      ${detailRow("Agenda", source.agendaItem)}
      ${detailRow("Topic", source.topic)}
      ${detailRow("Type", source.recordType || source.kind)}
      ${detailRow("Stance", source.stance)}
    </div>
    <p class="source-claim">${escapeHtml(source.claim || source.evidence || source.text || "Official source index record.")}</p>
    ${officialSource ? `<div class="source-official"><strong>Official source:</strong> ${escapeHtml(officialSource.title)}<p>${escapeHtml(officialSource.claim)}</p><a href="${escapeAttribute(officialSource.sourceUrl)}" target="_blank" rel="noreferrer">Open city source</a></div>` : ""}
    ${isHttpUrl(source.sourceUrl) ? `<a class="modal-source-link" href="${escapeAttribute(source.sourceUrl)}" target="_blank" rel="noreferrer">Open referenced page</a>` : ""}
    ${source.timestamp ? `<p class="timestamp-note">Timestamp: ${escapeHtml(source.timestamp)}</p>` : ""}
  `;
  elements.sourceModal.hidden = false;
  document.body.classList.add("modal-open");
}

function detailRow(label, value) {
  if (!value) return "";
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function closeSourceModal() {
  elements.sourceModal.hidden = true;
  document.body.classList.remove("modal-open");
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
elements.askBtn.addEventListener("click", askStaffer);
elements.askText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") askStaffer();
});
elements.daisModeBtn.addEventListener("click", () => setDaisMode(!state.daisMode));
elements.sessionSelect.addEventListener("change", () => {
  state.currentSessionId = elements.sessionSelect.value;
  connectEvents();
});
elements.closeSourceBtn.addEventListener("click", closeSourceModal);
elements.sourceModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-source]")) closeSourceModal();
});
document.addEventListener("click", (event) => {
  const sourceButton = event.target.closest("[data-source-id]");
  if (!sourceButton) return;
  event.preventDefault();
  openSourceModal(sourceButton.dataset.sourceId);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.sourceModal.hidden) closeSourceModal();
});

rebuildSourceIndex();
setDaisMode(state.daisMode);
loadSessions().catch((error) => {
  setStatus(error.message, "error");
});
