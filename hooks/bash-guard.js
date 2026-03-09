#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const input = await readJsonFromStdin();
if (input?.tool_name !== "Bash") {
  process.exit(0);
}

const command = input?.tool_input?.command ?? "";
if (!command) {
  process.exit(0);
}

const safePattern = /^(ls|pwd|echo|cat|git status|git log|git diff|git branch)\b/;
if (safePattern.test(command)) {
  process.exit(0);
}

const blockedRules = [
  { pattern: /chmod\s+777/, reason: "chmod 777 금지" },
  { pattern: /curl.*\|.*sh/, reason: "원격 스크립트 실행 금지" },
  { pattern: /wget.*\|.*sh/, reason: "원격 스크립트 실행 금지" },
  { pattern: /git.*push.*--force/, reason: "force push 금지" },
  { pattern: /git.*push.*-f(\s|$)/, reason: "force push 금지" },
  { pattern: /git.*reset.*--hard/, reason: "hard reset 금지" },
  { pattern: /git\s+restore\b/, reason: "git restore 금지 (다른 세션 작업 파괴 위험)" },
  { pattern: /git\s+checkout\s+--/, reason: "git checkout -- 금지 (다른 세션 작업 파괴 위험)" },
  { pattern: /git.*clean.*-f/, reason: "git clean 금지" },
  { pattern: /dd\s+if=/, reason: "dd 명령 금지" },
  { pattern: /mkfs/, reason: "mkfs 금지" },
  { pattern: /kill.*-9.*-1/, reason: "전체 프로세스 종료 금지" },
];

const blocked = blockedRules.find((rule) => rule.pattern.test(command));
if (!blocked) {
  process.exit(0);
}

const logDir = path.join(os.homedir(), ".claude", "logs");
fs.mkdirSync(logDir, { recursive: true });
fs.appendFileSync(
  path.join(logDir, "blocked.log"),
  `${formatTimestamp(new Date())} BLOCKED: ${command} (${blocked.reason})\n`,
  "utf8",
);
process.stderr.write(`Blocked: ${blocked.reason} - command: ${command}\n`);
process.exit(2);

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
