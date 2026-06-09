function loadStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("cmb-user") || "null");
  } catch {
    sessionStorage.removeItem("cmb-user");
    return null;
  }
}

const state = {
  sessions: [],
  meetings: [],
  currentSessionId: null,
  currentMeetingId: sessionStorage.getItem("cmb-current-meeting-id") || "",
  currentMeetingType: sessionStorage.getItem("cmb-current-meeting-type") || "commission",
  eventSource: null,
  transcript: [],
  alerts: [],
  notes: [],
  references: [],
  answers: [],
  prep: null,
  sourceIndex: new Map(),
  archiveLoaded: false,
  archiveSummary: null,
  totalRecordCount: 0,
  micActive: false,
  speechRecognition: null,
  accessToken: sessionStorage.getItem("cmb-access-token") || "",
  currentUser: loadStoredUser(),
  daisMode: localStorage.getItem("cmb-dais-mode") !== "false",
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
    id: "official-primegov",
    title: "PrimeGov public meeting portal",
    kind: "official-agenda-system",
    sourceUrl: "https://miamibeachfl.primegov.com/public/portal",
    claim: "PrimeGov is the city's current public portal for upcoming and archived meeting agendas, minutes, packets, and meeting video links."
  },
  {
    id: "official-weblink",
    title: "City Clerk Laserfiche/WebLink archive",
    kind: "official-record-system",
    sourceUrl: "https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=120704&dbid=0&repo=CityClerk",
    claim: "Laserfiche/WebLink is the City Clerk document archive for ordinances, resolutions, Letters to Commission, video link records, and related official files."
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
    sourceUrl: "https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=131458&dbid=0&repo=CityClerk",
    claim: "The City Clerk page links to Letters to Commission. LTCs are a key source for staff updates, policy implementation notes, and follow-up items."
  },
  {
    id: "official-resolutions-ordinances",
    title: "Resolutions and Ordinances",
    kind: "official-record-index",
    sourceUrl: "https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=120704&dbid=0&repo=CityClerk",
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
  accountPill: document.querySelector("#accountPill"),
  refreshBtn: document.querySelector("#refreshBtn"),
  sessionSelect: document.querySelector("#sessionSelect"),
  meetingSelect: document.querySelector("#meetingSelect"),
  liveSourceInput: document.querySelector("#liveSourceInput"),
  startLiveBtn: document.querySelector("#startLiveBtn"),
  preflightBtn: document.querySelector("#preflightBtn"),
  startMicBtn: document.querySelector("#startMicBtn"),
  startDemoBtn: document.querySelector("#startDemoBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  manualText: document.querySelector("#manualText"),
  sendLineBtn: document.querySelector("#sendLineBtn"),
  askText: document.querySelector("#askText"),
  askBtn: document.querySelector("#askBtn"),
  prepBtn: document.querySelector("#prepBtn"),
  prepPanel: document.querySelector("#prepPanel"),
  prepTitle: document.querySelector("#prepTitle"),
  prepSummary: document.querySelector("#prepSummary"),
  prepFlags: document.querySelector("#prepFlags"),
  prepQuestions: document.querySelector("#prepQuestions"),
  prepSources: document.querySelector("#prepSources"),
  closePrepBtn: document.querySelector("#closePrepBtn"),
  askFile: document.querySelector("#askFile"),
  attachedFileLabel: document.querySelector("#attachedFileLabel"),
  sourceUrl: document.querySelector("#sourceUrl"),
  answersList: document.querySelector("#answersList"),
  alertsList: document.querySelector("#alertsList"),
  reviewList: document.querySelector("#reviewList"),
  transcriptList: document.querySelector("#transcriptList"),
  notesList: document.querySelector("#notesList"),
  referenceList: document.querySelector("#referenceList"),
  answerCount: document.querySelector("#answerCount"),
  alertCount: document.querySelector("#alertCount"),
  reviewCount: document.querySelector("#reviewCount"),
  transcriptCount: document.querySelector("#transcriptCount"),
  noteCount: document.querySelector("#noteCount"),
  referenceCount: document.querySelector("#referenceCount"),
  recordCount: document.querySelector("#recordCount"),
  dashboardMode: document.querySelector("#dashboardMode"),
  dashboardAlertMetric: document.querySelector("#dashboardAlertMetric"),
  dashboardTranscriptMetric: document.querySelector("#dashboardTranscriptMetric"),
  dashboardMemoryMetric: document.querySelector("#dashboardMemoryMetric"),
  nextMeetingLine: document.querySelector("#nextMeetingLine"),
  sourceModal: document.querySelector("#sourceModal"),
  sourceModalTitle: document.querySelector("#sourceModalTitle"),
  sourceModalBody: document.querySelector("#sourceModalBody"),
  closeSourceBtn: document.querySelector("#closeSourceBtn"),
  authGate: document.querySelector("#authGate"),
  usernameInput: document.querySelector("#usernameInput"),
  accessTokenInput: document.querySelector("#accessTokenInput"),
  accessTokenBtn: document.querySelector("#accessTokenBtn"),
  authError: document.querySelector("#authError")
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
  elements.dashboardMode.textContent = text;
  elements.statusDot.classList.toggle("live", mode === "live");
  elements.statusDot.classList.toggle("error", mode === "error");
}

function statusDisplay(status) {
  if (status === "live") return { text: "Live", mode: "live" };
  if (status === "starting") return { text: "Starting", mode: "live" };
  if (status === "error") return { text: "Issue", mode: "error" };
  return { text: "Idle", mode: "idle" };
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload.error || "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    const error = new Error(detail || `${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
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

function renderMeetings() {
  if (!elements.meetingSelect) return;
  elements.meetingSelect.innerHTML = "";
  for (const meeting of state.meetings) {
    const option = document.createElement("option");
    option.value = meeting.id;
    option.dataset.meetingType = meeting.meetingType || "commission";
    option.textContent = `${formatMeetingDate(meeting.meetingDate)} - ${meeting.title}`;
    elements.meetingSelect.append(option);
  }

  const preferred = state.meetings.find((meeting) => String(meeting.id) === String(state.currentMeetingId))
    || state.meetings.find((meeting) => meeting.meetingType === "commission")
    || state.meetings[0];
  state.currentMeetingId = preferred?.id || "";
  state.currentMeetingType = preferred?.meetingType || "commission";
  if (state.currentMeetingId) elements.meetingSelect.value = state.currentMeetingId;
  sessionStorage.setItem("cmb-current-meeting-id", state.currentMeetingId);
  sessionStorage.setItem("cmb-current-meeting-type", state.currentMeetingType);
}

function renderSnapshot(session) {
  state.transcript = session.transcript || [];
  state.alerts = session.alerts || [];
  state.notes = session.notes || [];
  state.references = session.references || [];
  elements.sourceUrl.href = session.sourceUrl;
  elements.sourceUrl.textContent = session.sourceUrl;
  if (document.activeElement !== elements.liveSourceInput) {
    elements.liveSourceInput.value = session.sourceUrl || "";
  }
  const display = statusDisplay(session.status);
  setStatus(display.text, display.mode);
  renderDashboardMetrics();
  renderAnswers();
  renderAlerts();
  renderReviewQueue();
  renderTranscript();
  renderNotes();
  renderReferences();
}

function isAide() {
  return !state.currentUser || state.currentUser.role === "aide";
}

function isCommissioner() {
  return state.currentUser?.role === "commissioner";
}

function isDismissed(alert) {
  return alert.reviewStatus === "dismissed";
}

function isApprovedForCommissioner(alert) {
  return alert.reviewStatus === "approved" || alert.audience === "commissioner" || alert.type === "aide-card";
}

function sortedAlertItems(alerts) {
  const priorityRank = { high: 3, medium: 2, low: 1 };
  return [...alerts].sort((a, b) => {
    const rankDelta = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    if (rankDelta) return rankDelta;
    return new Date(b.at) - new Date(a.at);
  });
}

function renderAlerts() {
  const visibleAlerts = sortedAlertItems(state.alerts.filter((alert) => !isDismissed(alert) && (isCommissioner() ? isApprovedForCommissioner(alert) : isApprovedForCommissioner(alert))));
  elements.alertCount.textContent = `${visibleAlerts.length} card${visibleAlerts.length === 1 ? "" : "s"}`;
  elements.dashboardAlertMetric.textContent = visibleAlerts.length;
  elements.alertsList.innerHTML = "";
  if (!visibleAlerts.length) {
    elements.alertsList.append(emptyState(isCommissioner() ? "Aide-reviewed cards will appear here." : "Approved commissioner cards will appear here."));
    return;
  }

  for (const alert of visibleAlerts) {
    elements.alertsList.append(renderAlertCard(alert, { review: false }));
  }
}

function renderReviewQueue() {
  if (!elements.reviewList) return;
  const drafts = sortedAlertItems(state.alerts.filter((alert) => !isDismissed(alert) && alert.reviewStatus !== "sent" && !isApprovedForCommissioner(alert)));
  elements.reviewCount.textContent = `${drafts.length} draft${drafts.length === 1 ? "" : "s"}`;
  elements.reviewList.innerHTML = "";
  if (!drafts.length) {
    elements.reviewList.append(emptyState("Draft catches that need aide review will appear here."));
    return;
  }
  for (const alert of drafts) {
    elements.reviewList.append(renderAlertCard(alert, { review: true }));
  }
}

function renderAlertCard(alert, { review = false } = {}) {
    indexSources(alert.evidence);
    const item = document.createElement("article");
    item.className = `alert-item priority-${escapeClass(alert.priority)}`;
    const evidence = (alert.evidence || []).map(renderEvidence).join("");
    const confidence = alert.confidenceLabel || (alert.confidence ? `${alert.confidence} confidence` : "");
    item.innerHTML = `
      <div class="alert-topline">
        <div class="pill-row">
          <span class="priority-pill">${escapeHtml(alert.priority || "medium")}</span>
          ${confidence ? `<span class="confidence-pill">${escapeHtml(confidence)}</span>` : ""}
          ${alert.sourceCount ? `<span class="source-count-pill">${escapeHtml(alert.sourceCount)} source${alert.sourceCount === 1 ? "" : "s"}</span>` : ""}
        </div>
        <span>${formatTime(alert.at)}</span>
      </div>
      <h3>${escapeHtml(alert.title)}</h3>
      <p>${escapeHtml(alert.body)}</p>
      ${alert.why ? `<div class="why-box"><strong>Why this appeared</strong><p>${escapeHtml(alert.why)}</p></div>` : ""}
      <div class="recommendation">${escapeHtml(alert.recommendation || "")}</div>
      <div class="evidence-list">${evidence}</div>
      ${alert.createdBy ? `<p class="aide-credit">Sent by ${escapeHtml(alert.createdBy)}</p>` : ""}
      <div class="card-actions aide-only">
        ${review
          ? `<button class="compact-button" data-approve-alert-id="${escapeAttribute(alert.id)}">Send to Commissioner</button>
             <button class="secondary compact-button" data-dismiss-alert-id="${escapeAttribute(alert.id)}">Dismiss</button>`
          : `<button class="secondary compact-button" data-push-alert-id="${escapeAttribute(alert.id)}">Send Again</button>`}
      </div>
    `;
    return item;
}

function renderAnswers() {
  elements.answerCount.textContent = `${state.answers.length} answer${state.answers.length === 1 ? "" : "s"}`;
  elements.answersList.innerHTML = "";
  if (!state.answers.length) {
    elements.answersList.append(welcomeMessage());
    return;
  }

  for (const answer of state.answers) {
    indexSources(answer.evidence);
    const item = document.createElement("article");
    item.className = "chat-exchange";
    const suggestedQuestions = (answer.suggestedQuestions || answer.prep?.questions || [])
      .map((item) => `<button class="question-chip" data-question="${escapeAttribute(item.question)}">${escapeHtml(item.label || "Ask")}</button>`)
      .join("");
    item.innerHTML = `
      <div class="chat-message user-message">
        <div class="message-meta"><span>You</span><span>${formatTime(answer.at)}</span></div>
        <p>${escapeHtml(answer.question)}</p>
      </div>
      <div class="chat-message assistant-message">
        <div class="message-meta"><span>${escapeHtml(answer.mode)}</span><span>${escapeHtml(answer.confidenceLabel || "Source-backed")}</span></div>
        <p>${escapeHtml(answer.answer)}</p>
        ${answer.why ? `<div class="why-box"><strong>Why this answer</strong><p>${escapeHtml(answer.why)}</p></div>` : ""}
        <div class="recommendation">${escapeHtml(answer.recommendation)}</div>
        ${suggestedQuestions ? `<div class="suggested-questions">${suggestedQuestions}</div>` : ""}
        <div class="evidence-list">${answer.evidence.map(renderEvidence).join("")}</div>
        <div class="card-actions aide-only">
          <button class="secondary compact-button" data-push-answer-id="${escapeAttribute(answer.id)}">Send to Commissioner</button>
        </div>
      </div>
    `;
    elements.answersList.append(item);
  }
  elements.answersList.scrollTop = elements.answersList.scrollHeight;
}

function renderDashboardMetrics() {
  elements.dashboardAlertMetric.textContent = state.alerts.length;
  elements.dashboardTranscriptMetric.textContent = state.transcript.length;
  elements.dashboardMemoryMetric.textContent = state.totalRecordCount || STATIC_RECORDS.length;
}

function updateNextMeetingLine(records = STATIC_RECORDS) {
  const today = new Date(new Date().toDateString());
  const next = records
    .filter((record) => record.recordType === "primegov-upcoming-meeting")
    .filter((record) => record.committeeId === 2 || /commission/i.test(`${record.title} ${record.topic}`))
    .map((record) => ({ ...record, dateValue: new Date(`${record.meetingDate}T00:00:00`) }))
    .filter((record) => !Number.isNaN(record.dateValue.valueOf()) && record.dateValue >= today)
    .sort((a, b) => a.dateValue - b.dateValue)[0];
  elements.nextMeetingLine.textContent = next
    ? `${next.meetingTitle || next.title} is listed for ${formatMeetingDate(next.meetingDate)}.`
    : "No upcoming City Commission meeting found in the published index yet.";
}

function formatMeetingDate(value) {
  if (!value) return "the next listed date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function welcomeMessage() {
  const node = document.createElement("div");
  node.className = "welcome-message";
  node.innerHTML = `
    <strong>Ask anything from the dais.</strong>
    <p>Answers include the official sources they rely on.</p>
  `;
  return node;
}

function renderPrep(prep) {
  state.prep = prep;
  if (!prep) {
    elements.prepPanel.hidden = true;
    return;
  }

  indexSources(prep.sources);
  elements.prepPanel.hidden = false;
  elements.prepTitle.textContent = prep.title || "Meeting Prep";
  elements.prepSummary.textContent = prep.summary || "Current item checks and questions.";
  elements.prepFlags.innerHTML = (prep.flags || [])
    .map((flag) => `<span class="prep-flag ${flag.active ? "active" : ""}">${escapeHtml(flag.label)}</span>`)
    .join("");
  elements.prepQuestions.innerHTML = (prep.questions || [])
    .map((item) => `
      <button class="prep-question" data-question="${escapeAttribute(item.question)}">
        <span>${escapeHtml(item.label || "Question")}</span>
        ${escapeHtml(item.question)}
      </button>
    `)
    .join("");
  elements.prepSources.innerHTML = (prep.sources || []).slice(0, 4).map(renderEvidence).join("");
}

async function loadPrep(query = "") {
  try {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (state.currentMeetingId) params.set("meetingId", state.currentMeetingId);
    if (state.currentMeetingType) params.set("meetingType", state.currentMeetingType);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const payload = state.staticMode
      ? { prep: buildStaticPrep(query) }
      : await api(`/api/prep${suffix}`);
    renderPrep(payload.prep);
  } catch (error) {
    state.notes.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      title: "Prep unavailable",
      body: error.message,
      confidence: "needs-review",
      sources: []
    });
    renderNotes();
  }
}

function buildStaticPrep(query = "") {
  const sources = searchStaticMemory(query || "vote fiscal procurement resolution ordinance", { limit: 6 });
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    title: "Demo meeting prep",
    summary: `${sources.length} demo source record${sources.length === 1 ? "" : "s"} are ready. Use this as a rehearsal surface only.`,
    flags: [
      { id: "fiscal", label: "Fiscal", active: true },
      { id: "procurement", label: "Procurement", active: true },
      { id: "legal", label: "Legal form", active: true },
      { id: "history", label: "Prior record", active: true }
    ],
    questions: [
      { label: "Fiscal", question: "Can staff state the fiscal impact and whether a budget amendment is required?" },
      { label: "Procurement", question: "Can staff confirm whether an RFP, RFQ, bid, or contract path applies?" },
      { label: "History", question: "Has this item or a similar item come before the Commission before?" },
      { label: "Source", question: "Which agenda memo, LTC, resolution, or ordinance should we rely on as the source?" }
    ],
    sources
  };
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
  elements.dashboardTranscriptMetric.textContent = state.transcript.length;
  elements.transcriptList.innerHTML = "";
  if (!state.transcript.length) {
    elements.transcriptList.append(emptyState("Transcript appears in Full View."));
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

  const tokenParam = state.accessToken ? `?access_token=${encodeURIComponent(state.accessToken)}` : "";
  state.eventSource = new EventSource(`/api/sessions/${state.currentSessionId}/events${tokenParam}`);

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
    renderReviewQueue();
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
    const display = statusDisplay(status);
    setStatus(display.text, display.mode);
  });

  state.eventSource.onerror = () => setStatus("Connection issue", "error");
}

async function loadSessions() {
  try {
    const [sessionsPayload, recordsPayload, meetingsPayload] = await Promise.all([
      api("/api/sessions"),
      api("/api/records"),
      api("/api/meetings?meetingType=all")
    ]);
    state.staticMode = false;
    state.sessions = sessionsPayload.sessions;
    state.meetings = meetingsPayload.meetings || [];
    indexSources(recordsPayload.records);
    const recordCount = recordsPayload.totalRecordCount || recordsPayload.records.length;
    state.totalRecordCount = recordCount;
    elements.recordCount.textContent = `${recordCount} prior record${recordCount === 1 ? "" : "s"}`;
    elements.dashboardMemoryMetric.textContent = recordCount;
    updateNextMeetingLine(recordsPayload.records);
    renderSessions(sessionsPayload.defaultSessionId);
    renderMeetings();
    hideAuthGate();
    connectEvents();
  } catch (error) {
    if (error.status === 401) {
      showAuthGate();
      return;
    }
    startStaticMode();
  }
}

function applyUserMode({ forceRoleDefault = false } = {}) {
  const user = state.currentUser;
  document.body.classList.toggle("aide-mode", user?.role === "aide");
  document.body.classList.toggle("commissioner-mode", user?.role === "commissioner");

  if (elements.accountPill) {
    elements.accountPill.hidden = !user;
    elements.accountPill.textContent = user ? `${user.name} · ${user.role}` : "";
  }

  if (forceRoleDefault || user?.role === "commissioner") {
    if (user?.role === "commissioner") setDaisMode(true);
    if (user?.role === "aide") setDaisMode(false);
  }
}

function showAuthGate(message = "Sign in with the commissioner or aide account.") {
  elements.authGate.hidden = false;
  elements.authError.hidden = !message;
  elements.authError.textContent = message || "";
  elements.usernameInput.value = state.currentUser?.username || "";
  elements.accessTokenInput.value = "";
  setStatus("Locked", "error");
  setTimeout(() => (elements.usernameInput.value ? elements.accessTokenInput : elements.usernameInput).focus(), 0);
}

function hideAuthGate() {
  elements.authGate.hidden = true;
  elements.authError.hidden = true;
  elements.authError.textContent = "";
  setStatus("Connecting", "idle");
}

async function submitAccessToken() {
  const username = elements.usernameInput.value.trim();
  const password = elements.accessTokenInput.value.trim();
  if (!password) {
    showAuthGate("Enter the account password first.");
    return;
  }

  if (!username) {
    state.accessToken = password;
    state.currentUser = null;
    sessionStorage.setItem("cmb-access-token", password);
    sessionStorage.removeItem("cmb-user");
    applyUserMode();
    hideAuthGate();
    await loadSessions();
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Invalid username or password");

    state.accessToken = payload.token;
    state.currentUser = payload.user;
    sessionStorage.setItem("cmb-access-token", payload.token);
    sessionStorage.setItem("cmb-user", JSON.stringify(payload.user));
    applyUserMode({ forceRoleDefault: true });
    hideAuthGate();
    await loadSessions();
  } catch (error) {
    showAuthGate(error.message);
  }
}

async function runPreflight() {
  try {
    const payload = await api("/api/preflight");
    const failed = payload.checks.filter((check) => !check.ok && !check.optional);
    const optionalMissing = payload.checks.filter((check) => !check.ok && check.optional);
    const passed = payload.checks.length - failed.length;
    const agendaLine = payload.currentAgenda.length
      ? `${payload.currentAgenda.length} current agenda/source record${payload.currentAgenda.length === 1 ? "" : "s"} preloaded.`
      : "No upcoming commission agenda record is preloaded yet.";
    const optionalLine = optionalMissing.length ? ` Optional fallback not set: ${optionalMissing.map((check) => check.label).join(", ")}.` : "";
    state.notes.push({
      id: crypto.randomUUID(),
      at: payload.checkedAt,
      title: failed.length ? "Preflight needs attention" : "Preflight ready",
      body: `${passed}/${payload.checks.length} checks passed. ${agendaLine}${failed.length ? ` Needs: ${failed.map((check) => check.label).join(", ")}.` : ""}${optionalLine}`,
      confidence: failed.length ? "needs-review" : "source-assisted",
      sources: payload.currentAgenda
    });
    renderNotes();
  } catch (error) {
    state.notes.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      title: "Preflight failed",
      body: error.message,
      confidence: "needs-review",
      sources: []
    });
    renderNotes();
  }
}

async function pushAlertToDais(id) {
  const alert = state.alerts.find((item) => item.id === id);
  if (!alert || !state.currentSessionId) return;
  await pushCard({
    title: alert.title,
    body: alert.body,
    recommendation: alert.recommendation,
    evidence: alert.evidence,
    priority: alert.priority,
    source: "aide-alert"
  });
}

async function pushAnswerToDais(id) {
  const answer = state.answers.find((item) => item.id === id);
  if (!answer || !state.currentSessionId) return;
  await pushCard({
    title: answer.question,
    body: answer.answer,
    recommendation: answer.recommendation,
    evidence: answer.evidence,
    priority: "medium",
    source: "aide-answer"
  });
}

async function pushCard(card) {
  if (state.staticMode) {
    state.alerts.push({
      id: crypto.randomUUID(),
      type: "aide-card",
      confidenceLabel: "Aide reviewed",
      reviewStatus: "approved",
      audience: "commissioner",
      why: "An aide reviewed this item and sent it to the commissioner.",
      at: new Date().toISOString(),
      createdBy: state.currentUser?.name || "Aide",
      ...card
    });
    renderAlerts();
    return;
  }

  await api(`/api/sessions/${state.currentSessionId}/push-card`, {
    method: "POST",
    body: JSON.stringify(card)
  });
}

async function reviewAlert(id, action) {
  if (!id || !state.currentSessionId) return;
  if (state.staticMode) {
    const alert = state.alerts.find((item) => item.id === id);
    if (!alert) return;
    if (action === "dismiss") {
      alert.reviewStatus = "dismissed";
    } else {
      await pushAlertToDais(id);
      alert.reviewStatus = "sent";
    }
    renderAlerts();
    renderReviewQueue();
    return;
  }

  const payload = await api(`/api/sessions/${state.currentSessionId}/review-alert`, {
    method: "POST",
    body: JSON.stringify({ alertId: id, action })
  });
  renderSnapshot(payload.session);
}

async function loadPublicArchiveRecords() {
  if (state.archiveLoaded) return;
  state.archiveLoaded = true;
  try {
    const [recordsResponse, summaryResponse] = await Promise.all([
      fetch("data/official-archive-records.jsonl", { cache: "no-store" }),
      fetch("data/official-archive-summary.json", { cache: "no-store" })
    ]);
    if (!recordsResponse.ok) throw new Error("Archive index is not published yet.");
    const jsonl = await recordsResponse.text();
    const records = jsonl
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const existingIds = new Set(STATIC_RECORDS.map((record) => record.id));
    for (const record of records) {
      if (!existingIds.has(record.id)) {
        STATIC_RECORDS.push(record);
        existingIds.add(record.id);
      }
    }
    if (summaryResponse.ok) state.archiveSummary = await summaryResponse.json();
    indexSources(records);
  } catch (error) {
    console.info(error.message);
  } finally {
    const label = state.archiveSummary
      ? `${STATIC_RECORDS.length} records, ${state.archiveSummary.fromYear}+ archive`
      : `${STATIC_RECORDS.length} demo prior records`;
    state.totalRecordCount = STATIC_RECORDS.length;
    elements.recordCount.textContent = label;
    elements.dashboardMemoryMetric.textContent = STATIC_RECORDS.length;
    updateNextMeetingLine();
    renderAnswers();
    renderNotes();
    renderReferences();
  }
}

async function startDemo() {
  if (state.staticMode) {
    startStaticDemo();
    return;
  }
  await api(`/api/sessions/${state.currentSessionId}/start-demo`, { method: "POST", body: "{}" });
}

async function startLive() {
  const sourceUrl = elements.liveSourceInput.value.trim();
  if (state.staticMode) {
    setStatus("Backend needed", "error");
    return;
  }
  try {
    setStatus("Starting", "live");
    await api(`/api/sessions/${state.currentSessionId}/start-live`, {
      method: "POST",
      body: JSON.stringify({ sourceUrl })
    });
  } catch (error) {
    setStatus("Issue", "error");
    addLocalNote("Live transcription did not start", error.message);
  }
}

async function stopSession() {
  stopMicCapture({ updateStatus: false });
  if (state.staticMode) {
    stopStaticDemo();
    return;
  }
  await api(`/api/sessions/${state.currentSessionId}/stop`, { method: "POST", body: "{}" });
}

async function sendManualLine() {
  const text = elements.manualText.value.trim();
  if (!text) return;
  await addTranscriptLine({ speaker: "Manual", text });
  elements.manualText.value = "";
}

async function addTranscriptLine({ speaker, text }) {
  if (state.staticMode) {
    addStaticTranscript({ speaker, text });
    return;
  }
  await api(`/api/sessions/${state.currentSessionId}/transcript`, {
    method: "POST",
    body: JSON.stringify({ speaker, text, isFinal: true })
  });
}

function addLocalNote(title, body, confidence = "needs-setup") {
  state.notes.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    title,
    body,
    confidence,
    sources: []
  });
  renderNotes();
}

function startMicCapture() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    setStatus("Mic unavailable", "error");
    addLocalNote("Browser mic capture is not available", "This browser does not expose SpeechRecognition. Use Chrome desktop, the server Start Live worker, or manual live input.");
    return;
  }

  stopMicCapture({ updateStatus: false });
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  state.speechRecognition = recognition;
  state.micActive = true;

  recognition.onstart = () => setStatus("Mic live", "live");
  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result.isFinal) continue;
      const text = result[0]?.transcript?.trim();
      if (text) addTranscriptLine({ speaker: "Dais mic", text }).catch((error) => addLocalNote("Mic transcript failed", error.message));
    }
  };
  recognition.onerror = (event) => {
    addLocalNote("Mic capture issue", event.error || "Speech recognition reported an error.");
  };
  recognition.onend = () => {
    if (!state.micActive) return;
    setTimeout(() => {
      if (!state.micActive) return;
      try {
        recognition.start();
      } catch (error) {
        addLocalNote("Mic restart failed", error.message);
      }
    }, 500);
  };

  try {
    recognition.start();
  } catch (error) {
    setStatus("Mic unavailable", "error");
    addLocalNote("Mic capture did not start", error.message);
  }
}

function stopMicCapture({ updateStatus = true } = {}) {
  state.micActive = false;
  if (state.speechRecognition) {
    state.speechRecognition.onend = null;
    state.speechRecognition.stop();
  }
  state.speechRecognition = null;
  if (updateStatus && !state.staticMode) setStatus("Idle", "idle");
}

async function askStaffer() {
  const question = elements.askText.value.trim();
  if (!question) return;
  const fileContext = await readAttachedFile();
  const questionWithFile = fileContext ? `${question}\n\nAttached file context:\n${fileContext}` : question;
  let answer;
  if (!state.staticMode) {
    try {
      const payload = await api("/api/ask", {
        method: "POST",
        body: JSON.stringify({
          question: questionWithFile,
          meetingId: state.currentMeetingId,
          meetingType: state.currentMeetingType
        })
      });
      answer = payload.answer;
    } catch {
      answer = answerQuestion(questionWithFile);
    }
  } else {
    answer = answerQuestion(questionWithFile);
  }
  answer.question = fileContext ? `${question} [attached: ${elements.askFile.files[0].name}]` : question;
  indexSources(answer.evidence);
  state.answers.push(answer);
  if (answer.prep) renderPrep(answer.prep);
  elements.askText.value = "";
  clearAttachedFile();
  renderAnswers();
}

async function readAttachedFile() {
  const file = elements.askFile.files?.[0];
  if (!file) return "";
  const label = `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
  if (file.size > 1024 * 1024) {
    return `${label}. File is attached for handoff, but this public demo only previews files under 1 MB.`;
  }
  const textLike = /text|json|csv|markdown|html|xml/i.test(file.type) || /\.(txt|md|csv|json|html?|xml)$/i.test(file.name);
  if (!textLike) {
    return `${label}. File attached. Full extraction for this file type belongs in the production backend ingest pipeline.`;
  }
  const text = await file.text();
  return `${label}\n${text.slice(0, 5000)}`;
}

function updateAttachedFile() {
  const file = elements.askFile.files?.[0];
  if (!file) {
    elements.attachedFileLabel.hidden = true;
    elements.attachedFileLabel.textContent = "";
    return;
  }
  elements.attachedFileLabel.hidden = false;
  elements.attachedFileLabel.textContent = `Attached: ${file.name}`;
}

function clearAttachedFile() {
  elements.askFile.value = "";
  updateAttachedFile();
}

function answerQuestion(question) {
  const matches = searchStaticMemory(question, { limit: 6 });
  const person = detectPerson(question);
  const topic = detectTopic(question);
  const asksInconsistency = /inconsistent|contradict|different|before|previous|prior|said/i.test(question);
  const asksLiveReadiness = /fully live|working live|next commission meeting|live meeting|real time|production|launch/i.test(question);

  let answer = state.archiveSummary
    ? `I searched ${state.archiveSummary.recordCount} indexed official records from ${state.archiveSummary.fromYear} forward. Treat matches as leads until the source card is opened.`
    : "I found related source records in the city memory seed. Treat this as a lead until the official meeting record is opened.";
  let recommendation = "Open the evidence cards, then verify the official agenda packet, LTC, resolution, ordinance, or archived video before using it on the dais.";
  let mode = "Source pull";

  if (asksLiveReadiness) {
    mode = "Launch plan";
    answer = "To make this fully live for the next commission meeting, the core work is archive ingestion, live audio transcription, speaker labeling, secure dais access, and a verification workflow that forces every alert to cite an official source.";
    recommendation = "Start with the official meeting archive and MBTV feed: those unlock real-time transcript, source retrieval, and contradiction checks with confidence labels.";
  } else if (person && topic && asksInconsistency) {
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

  const readinessSources = OFFICIAL_SOURCES.filter((source) => ["official-meetings-agendas", "official-archived-meetings", "official-ltc", "official-resolutions-ordinances"].includes(source.id));
  const evidence = asksLiveReadiness ? readinessSources : (matches.length ? matches : OFFICIAL_SOURCES.slice(0, 4));
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
    ["live readiness", ["fully live", "working live", "next commission meeting", "real time", "production", "launch"]],
    ["officials", ["mayor", "commissioner", "city manager", "city clerk"]]
  ];
  return rules.find(([, needles]) => needles.some((needle) => lower.includes(needle)))?.[0] || "";
}

function startStaticMode() {
  state.staticMode = true;
  state.sessions = [staticSession()];
  state.currentSessionId = "static-demo";
  state.totalRecordCount = STATIC_RECORDS.length;
  elements.recordCount.textContent = `${STATIC_RECORDS.length} demo prior records`;
  elements.dashboardMemoryMetric.textContent = STATIC_RECORDS.length;
  renderSessions("static-demo");
  setStatus("Demo", "idle");
  renderSnapshot(staticSession());
  updateNextMeetingLine();
  loadPublicArchiveRecords();
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
    confidence: "demo",
    confidenceLabel: "Demo confidence",
    reviewStatus: "draft",
    audience: "aide",
    why: "Demo transcript language matched a seeded prior-record pattern.",
    sourceCount: Array.isArray(evidence) ? evidence.length : 0,
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
  elements.daisModeBtn.textContent = enabled ? "Full View" : "Dais Mode";
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
elements.startLiveBtn.addEventListener("click", startLive);
elements.preflightBtn.addEventListener("click", runPreflight);
elements.startMicBtn.addEventListener("click", startMicCapture);
elements.startDemoBtn.addEventListener("click", startDemo);
elements.stopBtn.addEventListener("click", stopSession);
elements.sendLineBtn.addEventListener("click", sendManualLine);
elements.askBtn.addEventListener("click", askStaffer);
elements.prepBtn.addEventListener("click", () => loadPrep(elements.askText.value.trim()));
elements.closePrepBtn.addEventListener("click", () => {
  elements.prepPanel.hidden = true;
});
elements.askText.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  askStaffer();
});
elements.askFile.addEventListener("change", updateAttachedFile);
document.querySelectorAll(".prompt-chip").forEach((button) => {
  button.addEventListener("click", () => {
    elements.askText.value = button.dataset.prompt || "";
    elements.askText.focus();
  });
});
elements.daisModeBtn.addEventListener("click", () => setDaisMode(!state.daisMode));
elements.sessionSelect.addEventListener("change", () => {
  state.currentSessionId = elements.sessionSelect.value;
  connectEvents();
});
elements.meetingSelect.addEventListener("change", () => {
  const option = elements.meetingSelect.selectedOptions[0];
  state.currentMeetingId = elements.meetingSelect.value;
  state.currentMeetingType = option?.dataset.meetingType || "commission";
  sessionStorage.setItem("cmb-current-meeting-id", state.currentMeetingId);
  sessionStorage.setItem("cmb-current-meeting-type", state.currentMeetingType);
  loadPrep(elements.askText.value.trim());
});
elements.closeSourceBtn.addEventListener("click", closeSourceModal);
elements.accessTokenBtn.addEventListener("click", submitAccessToken);
elements.accessTokenInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  submitAccessToken();
});
elements.usernameInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  elements.accessTokenInput.focus();
});
elements.sourceModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-source]")) closeSourceModal();
});
document.addEventListener("click", (event) => {
  const questionButton = event.target.closest("[data-question]");
  if (questionButton) {
    event.preventDefault();
    elements.askText.value = questionButton.dataset.question || "";
    elements.askText.focus();
    return;
  }

  const approveAlertButton = event.target.closest("[data-approve-alert-id]");
  if (approveAlertButton) {
    event.preventDefault();
    reviewAlert(approveAlertButton.dataset.approveAlertId, "approve").catch((error) => setStatus(error.message, "error"));
    return;
  }

  const dismissAlertButton = event.target.closest("[data-dismiss-alert-id]");
  if (dismissAlertButton) {
    event.preventDefault();
    reviewAlert(dismissAlertButton.dataset.dismissAlertId, "dismiss").catch((error) => setStatus(error.message, "error"));
    return;
  }

  const pushAlertButton = event.target.closest("[data-push-alert-id]");
  if (pushAlertButton) {
    event.preventDefault();
    pushAlertToDais(pushAlertButton.dataset.pushAlertId).catch((error) => setStatus(error.message, "error"));
    return;
  }

  const pushAnswerButton = event.target.closest("[data-push-answer-id]");
  if (pushAnswerButton) {
    event.preventDefault();
    pushAnswerToDais(pushAnswerButton.dataset.pushAnswerId).catch((error) => setStatus(error.message, "error"));
    return;
  }

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
applyUserMode();
loadSessions().catch((error) => {
  setStatus(error.message, "error");
});
