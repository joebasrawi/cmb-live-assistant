const OPENAI_KEY_NAMES = [
  "OPENAI_API_KEY",
  "OPENAI_KEY",
  "OPENAI_TOKEN",
  "OPENAI_SECRET_KEY",
  "OPEN_AI_API_KEY"
];

function rawOpenAiKey() {
  for (const name of OPENAI_KEY_NAMES) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

export function hasUsableOpenAiKey() {
  const key = openAiApiKey();
  return key.startsWith("sk-") && !key.includes("<") && !key.includes("your");
}

export function openAiApiKey() {
  return String(rawOpenAiKey()).trim().replace(/^["']|["']$/g, "");
}
