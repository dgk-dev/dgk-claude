#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const input = await readJsonFromStdin();
const toolName = input?.tool_name ?? "";
if (!["Write", "Edit", "MultiEdit"].includes(toolName)) {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path ?? "";
if (!/\.tsx?$/.test(filePath)) {
  process.exit(0);
}

let currentDir = path.dirname(filePath);
for (let level = 0; level < 3; level += 1) {
  if (fs.existsSync(path.join(currentDir, "tsconfig.json"))) {
    process.stdout.write(`[PostWrite] TS file changed: ${path.basename(filePath)} - recommended: npx tsc --noEmit\n`);
    process.exit(0);
  }
  const nextDir = path.dirname(currentDir);
  if (nextDir === currentDir) {
    break;
  }
  currentDir = nextDir;
}

process.exit(0);

async function readJsonFromStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim() ? JSON.parse(data) : {};
}
