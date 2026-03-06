#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const installScript = join(__dirname, "..", "install.sh");

if (!existsSync(installScript)) {
  console.error("[dgk-claude] install.sh not found. Please reinstall: npx dgk-claude");
  process.exit(1);
}

// bash 존재 확인
let bashPath = "bash";
if (platform() === "win32") {
  // Windows: Git Bash 경로 탐색
  const gitBashPaths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];
  const found = gitBashPaths.find((p) => existsSync(p));
  if (found) {
    bashPath = found;
  } else {
    console.error("[dgk-claude] Windows에서는 Git Bash가 필요합니다.");
    console.error("  Git for Windows 설치: https://git-scm.com/downloads/win");
    console.error("  또는 WSL2에서 실행하세요.");
    process.exit(1);
  }
}

try {
  execFileSync(bashPath, [installScript], { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
