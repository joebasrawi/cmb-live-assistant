const baseUrl = process.env.CMB_BASE_URL || "https://cmb-live-assistant-production.up.railway.app";
const token = process.env.ACCESS_TOKEN;

if (!token) {
  console.error("Set ACCESS_TOKEN before running this smoke test.");
  process.exit(1);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.error || `${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function requestWithToken(path, tokenOverride, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokenOverride}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  return { response, payload };
}

async function login(username, password) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.error || `${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectUnauthorized() {
  const response = await fetch(`${baseUrl}/api/records`);
  assert(response.status === 401, "Protected API should reject missing access token.");
}

async function main() {
  const results = [];
  const step = async (name, fn) => {
    const started = Date.now();
    await fn();
    results.push({ name, ms: Date.now() - started });
  };

  let sessionId = "";
  let aideLogin;
  let commissionerLogin;

  await step("public health", async () => {
    const health = await request("/api/health", { auth: false });
    assert(health.ok, "Health check did not return ok.");
    assert(health.live.openAiConfigured, "OpenAI is not configured.");
    assert(health.live.ffmpegAvailable, "ffmpeg is not available.");
    assert(health.live.ytDlpAvailable, "yt-dlp is not available.");
  });

  await step("auth gate", expectUnauthorized);

  await step("role login", async () => {
    aideLogin = await login(process.env.SMOKE_AIDE_USERNAME || "aide1", process.env.SMOKE_AIDE_PASSWORD || "aide");
    commissionerLogin = await login(process.env.SMOKE_COMMISSIONER_USERNAME || "commissioner", process.env.SMOKE_COMMISSIONER_PASSWORD || "dais");
    assert(aideLogin.user?.role === "aide", "Aide login did not return aide role.");
    assert(commissionerLogin.user?.role === "commissioner", "Commissioner login did not return commissioner role.");
  });

  await step("records index", async () => {
    const records = await request("/api/records");
    assert(records.totalRecordCount > 10000, "Official archive index looks too small.");
  });

  await step("ask primegov", async () => {
    const { answer } = await request("/api/ask", {
      method: "POST",
      body: { question: "Is the June 10 2026 Presentations and Awards Meeting listed in PrimeGov? Give me the official source." }
    });
    assert(/AI/.test(answer.mode), "Ask did not use AI mode.");
    assert(answer.evidence?.[0]?.title?.includes("Presentations and Awards Meeting"), "Ask did not rank the exact PrimeGov meeting first.");
    assert(!answer.modelError, `Ask returned model error: ${answer.modelError}`);
  });

  await step("ask official roster", async () => {
    const { answer } = await request("/api/ask", {
      method: "POST",
      body: { question: "Who is the City Manager and where is the official source?" }
    });
    assert(answer.evidence?.[0]?.title === "City Manager Eric Carpenter", "City Manager official roster card was not first.");
  });

  await step("create session", async () => {
    const { session } = await request("/api/sessions", {
      method: "POST",
      body: { title: "Production smoke test", sourceUrl: "https://www.youtube.com/c/CityofMiamiBeachTV/live" }
    });
    sessionId = session.id;
    assert(sessionId, "Session was not created.");
  });

  await step("aide card handoff", async () => {
    const blocked = await requestWithToken(`/api/sessions/${sessionId}/push-card`, commissionerLogin.token, {
      method: "POST",
      body: {
        title: "Blocked commissioner push",
        body: "Commissioner accounts should not push aide-reviewed cards."
      }
    });
    assert(blocked.response.status === 403, `Commissioner push should be forbidden, got ${blocked.response.status}.`);

    const pushed = await requestWithToken(`/api/sessions/${sessionId}/push-card`, aideLogin.token, {
      method: "POST",
      body: {
        title: "Smoke test aide handoff",
        body: "Aide reviewed this source-backed card for the commissioner.",
        recommendation: "Open the source, then ask staff to confirm on the record.",
        priority: "high",
        evidence: [
          {
            title: "Official MBTV",
            sourceUrl: "https://www.miamibeachfl.gov/mbtv/",
            claim: "City source page for meeting video and livestream access."
          }
        ]
      }
    });
    assert(pushed.response.ok, `Aide push failed with ${pushed.response.status}.`);
    const pushedCard = pushed.payload.session.alerts.find((item) => item.title === "Smoke test aide handoff");
    assert(pushedCard?.audience === "commissioner", "Pushed card was not marked for commissioner.");
    assert(pushedCard?.reviewStatus === "approved", "Pushed card was not marked approved.");

    const commissionerView = await requestWithToken(`/api/sessions/${sessionId}`, commissionerLogin.token);
    assert(commissionerView.response.ok, "Commissioner could not fetch session after handoff.");
    assert(
      commissionerView.payload.session.alerts.some((item) => item.title === "Smoke test aide handoff"),
      "Commissioner session did not include pushed card."
    );
  });

  await step("demo stream", async () => {
    await request(`/api/sessions/${sessionId}/start-demo`, { method: "POST" });
    await new Promise((resolve) => setTimeout(resolve, 9000));
    const { session } = await request(`/api/sessions/${sessionId}`);
    assert(session.transcript.length >= 3, "Demo did not generate transcript lines.");
    assert(session.alerts.length >= 1, "Demo did not generate proactive alerts.");
    assert(session.notes.length >= 1, "Demo did not generate source notes.");
  });

  await step("manual transcript", async () => {
    const { session } = await request(`/api/sessions/${sessionId}/transcript`, {
      method: "POST",
      body: {
        speaker: "Commissioner Tanya K. Bhatt",
        text: "I have always opposed Ocean Drive restrictions, and this has never come before us.",
        isFinal: true
      }
    });
    assert(session.alerts.length >= 1, "Manual transcript did not trigger alert analysis.");
  });

  await step("stop session", async () => {
    const { session } = await request(`/api/sessions/${sessionId}/stop`, { method: "POST" });
    assert(session.status === "idle", "Stop did not return the session to idle.");
  });

  await step("live readiness", async () => {
    const status = await request("/api/live/status");
    assert(status.readiness.openAiConfigured, "Live readiness lost OpenAI config.");
    assert(status.readiness.ffmpegAvailable, "Live readiness lost ffmpeg.");
    assert(status.readiness.ytDlpAvailable, "Live readiness lost yt-dlp.");
  });

  console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, status: error.status || null }, null, 2));
  process.exit(1);
});
