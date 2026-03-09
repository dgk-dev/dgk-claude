#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const input = await readJsonFromStdin();
const baseDir = input?.cwd ?? process.cwd();
const candidates = [
  { label: "HANDOFF", relativePath: ".claude/handoff.md" },
  { label: "HANDOFF", relativePath: ".claude/HANDOFF.md" },
  { label: "HANDOFF", relativePath: "HANDOFF.md" },
  { label: "HANDOFF", relativePath: "handoff.md" },
  { label: "STATE", relativePath: ".claude/STATE.md" },
  { label: "STATE", relativePath: "STATE.md" },
];

for (const candidate of candidates) {
  const resolved = path.join(baseDir, candidate.relativePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    continue;
  }

  const content = fs.readFileSync(resolved, "utf8").trim();
  if (!content) {
    continue;
  }

  process.stdout.write(`[${candidate.label}] Found ${candidate.relativePath}:\n---\n${content}\n---\n`);
  process.stdout.write(`[${candidate.label}] Use the content above to resume work accurately.\n`);
  process.exit(0);
}

process.exit(0);

async function readJsonFromStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim() ? JSON.parse(data) : {};
}
