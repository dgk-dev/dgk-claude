#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const input = await readJsonFromStdin();
const cwd = input?.cwd ?? "unknown";
const sessionId = input?.session_id ?? "";
if (isTeammate(sessionId)) {
  process.exit(0);
}

const env = loadEnvFile(path.join(os.homedir(), ".claude", ".env.local"));
const token = env.TELEGRAM_BOT_TOKEN;
const chatId = env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  process.exit(0);
}

const dirName = path.basename(cwd) || "unknown";
const message = `Done - waiting in ${dirName}`;

try {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    }),
  });
} catch {
  process.exit(0);
}

function isTeammate(sessionId) {
  if (!sessionId) {
    return false;
  }

  const teamsRoot = path.join(os.homedir(), ".claude", "teams");
  if (!fs.existsSync(teamsRoot)) {
    return false;
  }

  for (const entry of fs.readdirSync(teamsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const configPath = path.join(teamsRoot, entry.name, "config.json");
    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.leadSessionId === sessionId) {
        return false;
      }
      const members = Array.isArray(config.members) ? config.members.slice(1) : [];
      if (members.some((member) => typeof member?.agentId === "string" && member.agentId.includes(sessionId))) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

async function readJsonFromStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim() ? JSON.parse(data) : {};
}
