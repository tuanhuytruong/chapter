/** Safely recover one JSON object from model output without repairing syntax. */
function escapeRawControlsInStrings(json: string): string {
  let output = ""; let inString = false; let escaped = false;
  for (const char of json) {
    if (inString && !escaped && char === "\n") output += "\\n";
    else if (inString && !escaped && char === "\r") output += "\\r";
    else if (inString && !escaped && char === "\t") output += "\\t";
    else output += char;
    if (char === '"' && !escaped) inString = !inString;
    escaped = char === "\\" && !escaped;
    if (char !== "\\") escaped = false;
  }
  return output;
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || raw.trim();
  const start = fenced.indexOf("{"); const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM response did not contain JSON");
  const candidate = fenced.slice(start, end + 1);
  try { return JSON.parse(candidate); }
  catch (firstError) {
    try { return JSON.parse(escapeRawControlsInStrings(candidate)); }
    catch { throw firstError; }
  }
}
