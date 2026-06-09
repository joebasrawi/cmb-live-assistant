const DEFAULT_USERS = [
  { username: "commissioner", password: "dais", role: "commissioner", name: "Commissioner" },
  { username: "aide1", password: "aide", role: "aide", name: "Aide 1" },
  { username: "aide2", password: "aide", role: "aide", name: "Aide 2" }
];

function clean(value) {
  return String(value || "").trim();
}

function envUser(prefix, fallback) {
  return {
    username: clean(process.env[`${prefix}_USERNAME`]) || fallback.username,
    password: clean(process.env[`${prefix}_PASSWORD`]) || fallback.password,
    role: fallback.role,
    name: clean(process.env[`${prefix}_NAME`]) || fallback.name
  };
}

function configuredUsers() {
  if (process.env.CMB_USERS_JSON) {
    try {
      const users = JSON.parse(process.env.CMB_USERS_JSON);
      if (Array.isArray(users) && users.length) return users;
    } catch {
      // Fall back to env/default users.
    }
  }

  return [
    envUser("COMMISSIONER", DEFAULT_USERS[0]),
    envUser("AIDE1", DEFAULT_USERS[1]),
    envUser("AIDE2", DEFAULT_USERS[2])
  ];
}

const USERS = configuredUsers()
  .map((user) => ({
    username: clean(user.username).toLowerCase(),
    password: clean(user.password),
    role: clean(user.role) === "aide" ? "aide" : "commissioner",
    name: clean(user.name) || clean(user.username)
  }))
  .filter((user) => user.username && user.password);

export function publicUser(user) {
  if (!user) return null;
  return {
    username: user.username,
    role: user.role,
    name: user.name
  };
}

function userToken(user) {
  return `user:${user.username}:${user.password}`;
}

export function authenticateLogin({ username, password } = {}) {
  const normalizedUsername = clean(username).toLowerCase();
  const normalizedPassword = clean(password);
  const user = USERS.find((candidate) => (
    candidate.username === normalizedUsername &&
    candidate.password === normalizedPassword
  ));
  return user ? { user: publicUser(user), token: userToken(user) } : null;
}

export function authenticateRequest(request, url) {
  if (!process.env.ACCESS_TOKEN && !USERS.length) {
    return { username: "local", role: "aide", name: "Local" };
  }

  const header = request.headers.authorization || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const queryToken = url.searchParams.get("access_token") || "";
  const token = bearer || queryToken;

  if (process.env.ACCESS_TOKEN && token === process.env.ACCESS_TOKEN) {
    return { username: "token", role: "aide", name: "Legacy Token" };
  }

  const user = USERS.find((candidate) => token === userToken(candidate));
  return publicUser(user);
}
