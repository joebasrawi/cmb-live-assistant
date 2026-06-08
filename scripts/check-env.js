import { spawnSync } from "node:child_process";
import { hasUsableOpenAiKey } from "../src/openaiConfig.js";

function checkCommand(name, args = ["--version"]) {
  const result = spawnSync(name, args, { encoding: "utf8" });
  return {
    name,
    ok: result.status === 0,
    output: (result.stdout || result.stderr || "").split(/\r?\n/)[0]
  };
}

const checks = [
  { name: "OPENAI_API_KEY", ok: hasUsableOpenAiKey(), output: hasUsableOpenAiKey() ? "set" : "missing or invalid-looking" },
  checkCommand("ffmpeg", ["-version"]),
  checkCommand("yt-dlp", ["--version"])
];

console.log("CMB Live Assistant environment check");
for (const item of checks) {
  const mark = item.ok ? "OK" : "MISSING";
  console.log(`${mark.padEnd(8)} ${item.name} ${item.output ? `- ${item.output}` : ""}`);
}

if (!process.env.OPENAI_API_KEY) {
  console.log("\nOPENAI_API_KEY is required for Start Live / live transcription.");
}
