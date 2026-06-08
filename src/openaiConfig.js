export function hasUsableOpenAiKey() {
  const key = process.env.OPENAI_API_KEY || "";
  return key.startsWith("sk-") && !key.includes("<") && !key.includes("your");
}
