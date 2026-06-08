const TOPIC_RULES = [
  { topic: "Ocean Drive", patterns: [/ocean drive/i, /lummus park/i, /art deco/i] },
  { topic: "budget", patterns: [/budget/i, /appropriation/i, /amendment/i, /millage/i] },
  { topic: "procurement", patterns: [/\brfp\b/i, /\brfq\b/i, /\bbid\b/i, /procurement/i, /contract/i] },
  { topic: "housing", patterns: [/housing/i, /live local/i, /workforce/i, /affordable/i] },
  { topic: "transportation", patterns: [/transit/i, /parking/i, /mobility/i, /bike/i, /traffic/i] },
  { topic: "public safety", patterns: [/police/i, /fire/i, /emergency/i, /public safety/i] },
  { topic: "resilience", patterns: [/resilien/i, /stormwater/i, /sea level/i, /flood/i] }
];

const RECORD_RULES = [
  { type: "ordinance", pattern: /\bordinance(?:\s+no\.?)?\s*([0-9-]+)?/gi },
  { type: "resolution", pattern: /\bresolution(?:\s+no\.?)?\s*([0-9-]+)?/gi },
  { type: "ltc", pattern: /\bLTC\s*(?:no\.?)?\s*([0-9-/]+)?/gi },
  { type: "agenda-item", pattern: /\b(?:R|C|NB|PA|PH|SM)\d{1,2}[A-Z]?\b/gi }
];

function uniqueReferences(references) {
  const seen = new Set();
  const result = [];
  for (const reference of references) {
    const key = `${reference.type}:${reference.value}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(reference);
    }
  }
  return result;
}

export function detectReferences(text) {
  const references = [];

  for (const rule of RECORD_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      references.push({
        type: rule.type,
        value: match[0].replace(/\s+/g, " ").trim(),
        confidence: rule.type === "agenda-item" ? "high" : "medium"
      });
    }
  }

  for (const rule of TOPIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      references.push({
        type: "topic",
        value: rule.topic,
        confidence: "medium"
      });
    }
  }

  return uniqueReferences(references);
}
