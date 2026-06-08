export function hasUsableOpenAiKey() {
  const key = String(process.env.OPENAI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  return key.startsWith("sk-") && !key.includes("<") && !key.includes("your");
}

export function openAiApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
}
