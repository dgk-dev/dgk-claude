#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const input = await readJsonFromStdin();
const logDir = path.join(os.homedir(), ".claude", "logs");
fs.mkdirSync(logDir, { recursive: true });

const tool = input?.tool_name ?? "N/A";
const toolInput = input?.tool_input ?? {};
const command = toolInput.command ?? toolInput.file_path ?? "N/A";
const timestamp = formatTimestamp(new Date());

fs.appendFileSync(path.join(logDir, "audit.log"), `${timestamp} | ${tool} | ${command}\n`, "utf8");

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function readJsonFromStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim() ? JSON.parse(data) : {};
}
