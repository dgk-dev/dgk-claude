#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const claudeDir = path.join(os.homedir(), ".claude");
const skillsDir = path.join(claudeDir, "skills");
const hooksDir = path.join(claudeDir, "hooks");
const settingsPath = path.join(claudeDir, "settings.json");
const backupRoot = path.join(claudeDir, "dgk-claude-backups");

const hookRegistrations = [
  { event: "SessionStart", matcher: "", script: "add-date.js" },
  { event: "SessionStart", matcher: "", script: "handoff-load.js" },
  { event: "SessionStart", matcher: "compact", script: "compact-reinject.js" },
  { event: "PreToolUse", matcher: "Bash", script: "bash-guard.js" },
  { event: "PreToolUse", matcher: "Bash", script: "audit-log.js" },
  { event: "PreToolUse", matcher: "Bash", script: "rtk-rewrite.js" },
  { event: "PreToolUse", matcher: "WebFetch", script: "block-webfetch.js" },
  { event: "PostToolUse", matcher: "Write|Edit", script: "postwrite-check.js" },
  { event: "Notification", matcher: "", script: "telegram-notify.js" },
];

const colors = process.stdout.isTTY
  ? {
      blue: "\u001b[0;34m",
      cyan: "\u001b[0;36m",
      green: "\u001b[0;32m",
      red: "\u001b[0;31m",
      yellow: "\u001b[1;33m",
      reset: "\u001b[0m",
    }
  : {
      blue: "",
      cyan: "",
      green: "",
      red: "",
      yellow: "",
      reset: "",
    };

function info(message) {
  console.log(`${colors.blue}[dgk-claude]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}[dgk-claude]${colors.reset} ${message}`);
}

function warn(message) {
  console.log(`${colors.yellow}[dgk-claude]${colors.reset} ${message}`);
}

function error(message) {
  console.error(`${colors.red}[dgk-claude]${colors.reset} ${message}`);
}

function dim(message) {
  console.log(`${colors.cyan}${message}${colors.reset}`);
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function listRelativeFiles(root) {
  const results = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const child of listRelativeFiles(fullPath)) {
        results.push(path.join(entry.name, child));
      }
      continue;
    }
    results.push(entry.name);
  }
  return results.sort();
}

function directoriesDiffer(sourceDir, targetDir) {
  if (!existsSync(targetDir)) {
    return true;
  }

  const sourceFiles = listRelativeFiles(sourceDir);
  const targetFiles = listRelativeFiles(targetDir);
  if (sourceFiles.length !== targetFiles.length) {
    return true;
  }

  for (let index = 0; index < sourceFiles.length; index += 1) {
    if (sourceFiles[index] !== targetFiles[index]) {
      return true;
    }

    const sourceFile = path.join(sourceDir, sourceFiles[index]);
    const targetFile = path.join(targetDir, targetFiles[index]);
    if (hashFile(sourceFile) !== hashFile(targetFile)) {
      return true;
    }
  }

  return false;
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function timestampStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupPathFor(targetPath, stamp) {
  const relative = path.relative(claudeDir, targetPath);
  return path.join(backupRoot, stamp, relative);
}

function backupTarget(targetPath, stamp) {
  if (!existsSync(targetPath)) {
    return null;
  }

  const destination = backupPathFor(targetPath, stamp);
  ensureDir(path.dirname(destination));
  cpSync(targetPath, destination, { recursive: true });
  return destination;
}

function copyDirectory(sourceDir, targetDir) {
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });
}

function parseArgs(argv) {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) {
    console.log(`dgk-claude

Usage:
  npx dgk-claude [--yes] [--dry-run] [--skip-glm-review] [--check-ret] [--install-system-deps]

Options:
  --yes              Skip confirmation prompt
  --dry-run          Show the install plan without changing files
  --check-ret        Only run /ret preflight checks
  --install-system-deps
                     Attempt to install missing system dependencies such as tmux
  --skip-glm-review  Do not attempt to install glm-review
  --help             Show this message
`);
    process.exit(0);
  }

  for (const value of args) {
    if (!["--yes", "--dry-run", "--check-ret", "--install-system-deps", "--skip-glm-review", "--help", "-h"].includes(value)) {
      error(`unknown option: ${value}`);
      process.exit(1);
    }
  }

  return {
    checkRetOnly: args.has("--check-ret"),
    dryRun: args.has("--dry-run"),
    installSystemDeps: args.has("--install-system-deps"),
    skipPrompt: args.has("--yes"),
    skipGlmReview: args.has("--skip-glm-review"),
  };
}

function detectRuntime() {
  const platform = process.platform;
  const osName =
    platform === "darwin" ? "macos" :
    platform === "linux" ? "linux" :
    platform === "win32" ? "windows" :
    platform;
  return { osName, platform };
}

function collectPlan(runtime) {
  const plans = {
    hooks: [],
    settings: [],
    skills: [],
  };

  const skillRoot = path.join(packageRoot, "skills");
  for (const entry of readdirSync(skillRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const source = path.join(skillRoot, entry.name);
    const target = path.join(skillsDir, entry.name);
    const action =
      !existsSync(target) ? "install" :
      directoriesDiffer(source, target) ? "update" :
      "skip";
    plans.skills.push({ action, name: entry.name, source, target });
  }

  const hookRoot = path.join(packageRoot, "hooks");
  for (const entry of readdirSync(hookRoot, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const source = path.join(hookRoot, entry.name);
    const target = path.join(hooksDir, entry.name);
    const action =
      !existsSync(target) ? "install" :
      hashFile(source) !== hashFile(target) ? "update" :
      "skip";
    plans.hooks.push({ action, name: entry.name, source, target });
  }

  const settingsAction = !existsSync(settingsPath)
    ? "create"
    : "merge";

  plans.settings.push({ action: settingsAction, path: settingsPath });
  return plans;
}

function commandForHook(_runtime, scriptName) {
  return `node "$HOME/.claude/hooks/${scriptName}"`;
}

function countExistingHookCommands(settings) {
  const events = settings?.hooks ?? {};
  return Object.values(events)
    .flatMap((groups) => Array.isArray(groups) ? groups : [])
    .flatMap((group) => Array.isArray(group?.hooks) ? group.hooks : [])
    .length;
}

function describePlan(plans, runtime, options) {
  console.log("");
  info(`dgk-claude 설치 준비 중... (OS: ${runtime.osName})`);
  console.log("");
  info("=== 설치 계획 ===");
  console.log("");

  for (const skill of plans.skills) {
    if (skill.action === "install") {
      info(`  설치  /${skill.name}`);
    } else if (skill.action === "update") {
      info(`  업데이트  /${skill.name}`);
    } else {
      dim(`  스킵  /${skill.name} (최신 상태)`);
    }
  }

  console.log("");

  for (const hook of plans.hooks) {
    if (hook.action === "install") {
      info(`  설치  ${hook.name}`);
    } else if (hook.action === "update") {
      info(`  업데이트  ${hook.name}`);
    } else {
      dim(`  스킵  ${hook.name} (최신 상태)`);
    }
  }

  console.log("");

  if (plans.settings[0].action === "create") {
    info("  settings.json: 새로 생성 후 hooks 병합");
  } else if (plans.settings[0].action === "merge") {
    const parsed = loadSettings();
    info(`  settings.json: 기존 hooks ${countExistingHookCommands(parsed)}개 유지 + dgk-claude hooks 병합`);
  }

  if (options.skipGlmReview) {
    dim("  스킵  glm-review (--skip-glm-review)");
  } else if (commandExists("glm-review")) {
    dim("  스킵  glm-review (이미 설치됨)");
  } else if (commandExists("npm")) {
    info("  설치  glm-review (npm install -g)");
  } else {
    warn("  스킵  glm-review (npm 없음)");
  }

  console.log("");
}

function commandExists(command) {
  const overridesRaw = process.env.DGK_CLAUDE_TEST_COMMANDS;
  if (overridesRaw) {
    try {
      const overrides = JSON.parse(overridesRaw);
      if (Object.prototype.hasOwnProperty.call(overrides, command)) {
        return Boolean(overrides[command]);
      }
    } catch {
      // Ignore malformed test overrides outside controlled test runs.
    }
  }

  const checker = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(checker, [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function readTextFileIfExists(filePath) {
  try {
    return existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
  } catch {
    return null;
  }
}

function getMcpConfigCandidates() {
  return [
    path.join(os.homedir(), ".claude.json"),
    path.join(os.homedir(), ".config", "claude-code", "config.json"),
    path.join(os.homedir(), ".claude", "config.json"),
  ];
}

function collectRetPreflight(runtime) {
  const tmuxInstalled = commandExists("tmux");
  const claudeInstalled = commandExists("claude");
  const mcpChecks = detectMcpServers();
  const installHint = getTmuxInstallHint(runtime);
  return {
    claudeInstalled,
    installHint,
    mcpChecks,
    maxPlanStatus: "manual",
    teamsStatus: "manual",
    tmuxInstalled,
  };
}

function detectMcpServers() {
  const expected = [
    {
      displayName: "Context7 MCP",
      installCommand: "claude mcp add context7-mcp -- npx -y @context7/mcp",
      keys: ["context7-mcp", "context7"],
    },
    {
      displayName: "Jina MCP",
      installCommand: "claude mcp add jina -- npx -y @jina-ai/mcp-server",
      keys: ["jina", "@jina-ai/mcp-server"],
    },
    {
      displayName: "Sequential Thinking MCP",
      installCommand: "claude mcp add sequential-thinking -- npx -y @anthropic/sequential-thinking-mcp",
      keys: ["sequential-thinking", "@anthropic/sequential-thinking-mcp"],
    },
  ];

  const sources = getMcpConfigCandidates()
    .map((candidate) => ({ path: candidate, content: readTextFileIfExists(candidate) }))
    .filter((entry) => entry.content);

  return expected.map((entry) => {
    const source = sources.find(({ content }) => entry.keys.some((key) => content.toLowerCase().includes(key.toLowerCase())));
    return {
      ...entry,
      configured: Boolean(source),
      sourcePath: source?.path ?? null,
    };
  });
}

function getTmuxInstallHint(runtime) {
  if (runtime.platform === "darwin") {
    return "brew install tmux";
  }
  if (runtime.platform === "linux") {
    if (commandExists("apt-get")) {
      return "sudo apt-get install -y tmux";
    }
    if (commandExists("dnf")) {
      return "sudo dnf install -y tmux";
    }
    if (commandExists("yum")) {
      return "sudo yum install -y tmux";
    }
    if (commandExists("pacman")) {
      return "sudo pacman -Sy --noconfirm tmux";
    }
    if (commandExists("zypper")) {
      return "sudo zypper install -y tmux";
    }
    if (commandExists("apk")) {
      return "sudo apk add tmux";
    }
  }
  if (runtime.platform === "win32") {
    return "Native Windows tmux auto-install is not supported. Use WSL and install tmux there.";
  }
  return "Install tmux with your system package manager.";
}

function getTmuxInstallCommand(runtime) {
  const runWithSudo = typeof process.getuid === "function" && process.getuid() !== 0;
  if (runtime.platform === "darwin" && commandExists("brew")) {
    return { command: "brew", args: ["install", "tmux"] };
  }
  if (runtime.platform !== "linux") {
    return null;
  }

  const managers = [
    { binary: "apt-get", args: ["install", "-y", "tmux"] },
    { binary: "dnf", args: ["install", "-y", "tmux"] },
    { binary: "yum", args: ["install", "-y", "tmux"] },
    { binary: "pacman", args: ["-Sy", "--noconfirm", "tmux"] },
    { binary: "zypper", args: ["install", "-y", "tmux"] },
    { binary: "apk", args: ["add", "tmux"] },
  ];

  const manager = managers.find(({ binary }) => commandExists(binary));
  if (!manager) {
    return null;
  }

  if (!runWithSudo) {
    return { command: manager.binary, args: manager.args };
  }
  if (!commandExists("sudo")) {
    return { command: null, args: [], requiresSudo: true, manager: manager.binary };
  }
  return { command: "sudo", args: [manager.binary, ...manager.args] };
}

function maybeInstallSystemDeps(runtime, options, preflight) {
  console.log("");
  info("=== /ret 시스템 요구사항 ===");

  if (preflight.tmuxInstalled) {
    success("tmux: 설치됨");
    return collectRetPreflight(runtime);
  }

  warn(`tmux: 없음 — /ret 팀 모드에는 필요합니다.`);
  info(`설치 명령: ${preflight.installHint}`);

  if (!options.installSystemDeps) {
    warn("자동 설치를 원하면 --install-system-deps로 다시 실행하세요.");
    return preflight;
  }

  const installCommand = getTmuxInstallCommand(runtime);
  if (!installCommand?.command) {
    warn("현재 환경에서는 tmux 자동 설치를 지원하지 않습니다.");
    return preflight;
  }

  info(`tmux 자동 설치 시도: ${[installCommand.command, ...installCommand.args].join(" ")}`);
  try {
    execFileSync(installCommand.command, installCommand.args, { stdio: "inherit" });
    success("tmux 설치 완료");
  } catch {
    warn(`tmux 자동 설치 실패. 수동 설치: ${preflight.installHint}`);
  }

  return collectRetPreflight(runtime);
}

function printRetPreflightSummary(preflight) {
  console.log("");
  info("=== /ret 프리플라이트 ===");
  if (preflight.tmuxInstalled) {
    success("tmux: ready");
  } else {
    warn("tmux: missing");
  }

  if (preflight.claudeInstalled) {
    success("claude CLI: detected");
  } else {
    warn("claude CLI: not detected");
  }

  for (const mcp of preflight.mcpChecks) {
    if (mcp.configured) {
      success(`${mcp.displayName}: configured${mcp.sourcePath ? ` (${mcp.sourcePath})` : ""}`);
    } else {
      warn(`${mcp.displayName}: missing`);
      info(`  설치: ${mcp.installCommand}`);
    }
  }

  info("Agent Teams: manual check required");
  info("Max plan: manual check required");
  if (!preflight.tmuxInstalled) {
    info(`tmux 설치 힌트: ${preflight.installHint}`);
  }
}

async function shouldProceed(options) {
  if (options.skipPrompt || !process.stdin.isTTY) {
    if (!process.stdin.isTTY) {
      info("비대화 모드 — 자동 설치 진행");
      console.log("");
    }
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const response = (await rl.question(`${colors.blue}[dgk-claude]${colors.reset} 위 계획대로 설치를 진행할까요? [Y/n] `)).trim();
  rl.close();
  if (response && /^[Nn]/.test(response)) {
    info("설치를 취소했습니다.");
    return false;
  }
  console.log("");
  return true;
}

function loadSettings() {
  if (!existsSync(settingsPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    error(`settings.json이 유효한 JSON이 아닙니다. 수동으로 확인하세요: ${settingsPath}`);
    process.exit(1);
  }
}

function registerHook(settings, registration, runtime) {
  settings.hooks ??= {};
  settings.hooks[registration.event] ??= [];
  const groups = settings.hooks[registration.event];
  const matcher = registration.matcher;
  const command = commandForHook(runtime, registration.script);

  pruneLegacyHookCommands(groups, registration.script, command);

  if (groups.some((group) => Array.isArray(group?.hooks) && group.hooks.some((hook) => hook.command === command))) {
    return false;
  }

  const existingGroup = groups.find((group) => group?.matcher === matcher);
  const hookEntry = { type: "command", command };
  if (existingGroup) {
    existingGroup.hooks ??= [];
    existingGroup.hooks.push(hookEntry);
  } else {
    groups.push({ matcher, hooks: [hookEntry] });
  }

  return true;
}

function pruneLegacyHookCommands(groups, scriptName, currentCommand) {
  const baseName = scriptName.replace(/\.js$/, "");
  const legacyPatterns = [
    new RegExp(`(^|[\\\\/"'])${baseName}\\.sh(["' ]|$)`),
    new RegExp(`(^|[\\\\/"'])${baseName}\\.js(["' ]|$)`),
  ];

  for (const group of groups) {
    if (!Array.isArray(group?.hooks)) {
      continue;
    }
    group.hooks = group.hooks.filter((hook) => {
      const hookCommand = hook?.command ?? "";
      if (hookCommand === currentCommand) {
        return true;
      }
      if (!/\.claude[\\/]+hooks/.test(hookCommand) && !hookCommand.includes("$HOME/.claude/hooks")) {
        return true;
      }
      return !legacyPatterns.some((pattern) => pattern.test(hookCommand));
    });
  }
}

function maybeInstallGlmReview(options) {
  console.log("");
  info("=== glm-review 설치 (코드 리뷰) ===");

  if (options.skipGlmReview) {
    warn("glm-review 설치 스킵");
    return;
  }

  if (!commandExists("npm")) {
    warn("npm 미설치 — glm-review 스킵. /rr, /rrr 사용 시 수동 설치: npm install -g glm-review");
    return;
  }

  if (commandExists("glm-review")) {
    warn("glm-review: 이미 설치됨 — 스킵");
    return;
  }

  if (!process.stdin.isTTY && !options.skipPrompt) {
    warn("비대화 모드에서는 glm-review 자동 설치를 건너뜁니다. 필요 시 수동 설치: npm install -g glm-review");
    return;
  }

  info("npm install -g glm-review 실행 중...");
  try {
    execFileSync("npm", ["install", "-g", "glm-review"], { stdio: "inherit" });
    success("glm-review 설치 완료 — /rr, /rrr 사용 가능");
  } catch {
    warn("glm-review 설치 실패. 수동 설치: npm install -g glm-review");
  }
}

function applyInstall(plans, runtime, options) {
  const stamp = timestampStamp();
  const backupDir = path.join(backupRoot, stamp);
  const backupPaths = [];
  let changed = false;

  console.log("");
  info("=== Skills 설치 ===");
  ensureDir(skillsDir);
  for (const skill of plans.skills) {
    if (skill.action === "skip") {
      warn(`${skill.name}: 최신 상태 — 스킵`);
      continue;
    }

    if (skill.action === "update") {
      const backup = backupTarget(skill.target, stamp);
      if (backup) {
        backupPaths.push(backup);
      }
      copyDirectory(skill.source, skill.target);
      success(`${skill.name} 스킬 업데이트 완료`);
      changed = true;
      continue;
    }

    copyDirectory(skill.source, skill.target);
    success(`${skill.name} 스킬 설치 완료`);
    changed = true;
  }

  console.log("");
  info("=== Hooks 파일 설치 ===");
  ensureDir(hooksDir);
  for (const hook of plans.hooks) {
    if (hook.action === "skip") {
      warn(`${hook.name}: 최신 상태 — 스킵`);
      continue;
    }
    if (hook.action === "update") {
      const backup = backupTarget(hook.target, stamp);
      if (backup) {
        backupPaths.push(backup);
      }
      cpSync(hook.source, hook.target);
      success(`${hook.name} 업데이트 완료`);
      changed = true;
      continue;
    }

    cpSync(hook.source, hook.target);
    success(`${hook.name} 설치 완료`);
    changed = true;
  }

  console.log("");
  info("=== settings.json hooks 등록 ===");
  ensureDir(claudeDir);
  const before = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : null;
  const settings = loadSettings();
  let registered = 0;
  for (const registration of hookRegistrations) {
    if (registerHook(settings, registration, runtime)) {
      success(`${registration.script} → ${registration.event}${registration.matcher ? ` (${registration.matcher})` : ""}`);
      registered += 1;
    } else {
      warn(`${registration.script}: 이미 등록됨 — 스킵`);
    }
  }

  const after = `${JSON.stringify(settings, null, 2)}\n`;
  if (before !== after) {
    if (existsSync(settingsPath)) {
      const backup = backupTarget(settingsPath, stamp);
      if (backup) {
        backupPaths.push(backup);
      }
    }
    writeFileSync(settingsPath, after, "utf8");
    changed = true;
  } else if (registered === 0) {
    warn("settings.json: 최신 상태 — 스킵");
  }

  maybeInstallGlmReview(options);
  const retPreflight = maybeInstallSystemDeps(runtime, options, collectRetPreflight(runtime));
  printRetPreflightSummary(retPreflight);

  console.log("");
  success(changed ? "설치 완료!" : "이미 최신 상태입니다.");
  if (backupPaths.length > 0) {
    info(`백업 위치: ${backupDir}`);
  }
  console.log("");
  info("다음 단계:");
  info("  1. Claude Code 재시작");
  info("  2. /rr, /rrr 사용 시: ZAI_API_KEY 설정 필요 — echo \"ZAI_API_KEY='키값'\" >> ~/.claude/.env.local");
  info("  3. Telegram 알림 사용 시: ~/.claude/.env.local에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 추가");
  info("  4. /ret 사용 전: tmux + MCP 3개 + Agent Teams + Max 준비 상태 확인");
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const runtime = detectRuntime();
  if (options.checkRetOnly) {
    const retPreflight = maybeInstallSystemDeps(runtime, options, collectRetPreflight(runtime));
    printRetPreflightSummary(retPreflight);
    return;
  }
  const plans = collectPlan(runtime);
  describePlan(plans, runtime, options);

  if (options.dryRun) {
    info("dry-run 완료 — 파일 변경 없음");
    return;
  }

  if (!(await shouldProceed(options))) {
    return;
  }

  applyInstall(plans, runtime, options);
}

await main();
