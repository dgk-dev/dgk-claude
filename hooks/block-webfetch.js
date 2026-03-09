#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const logDir = path.join(os.homedir(), ".claude", "logs");
fs.mkdirSync(logDir, { recursive: true });
fs.appendFileSync(
  path.join(logDir, "blocked.log"),
  `${formatTimestamp(new Date())} BLOCKED: WebFetch 사용 시도\n`,
  "utf8",
);
process.stderr.write("Blocked: WebFetch is disabled. Use Jina MCP (mcp__jina__read_url) instead.\n");
process.exit(2);

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
