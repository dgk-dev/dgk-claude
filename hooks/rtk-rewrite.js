#!/usr/bin/env node

import { spawnSync } from "node:child_process";

if (!commandExists("rtk")) {
  process.exit(0);
}

const input = await readJsonFromStdin();
const command = input?.tool_input?.command ?? "";
if (!command || command.startsWith("rtk ") || command.includes("<<")) {
  process.exit(0);
}

const envMatch = command.match(/^([A-Za-z_][A-Za-z0-9_]*=[^ ]* +)+/);
const envPrefix = envMatch?.[0] ?? "";
const matchCommand = command.slice(envPrefix.length);
let rewritten = "";

rewritten ||= rewriteWithPrefix(matchCommand, envPrefix, command, [
  [/^git\s+(status|diff|log|add|commit|push|pull|branch|fetch|stash|show)\b/, () => `rtk ${matchCommand}`],
  [/^gh\s+(pr|issue|run|api|release)\b/, () => matchCommand.replace(/^gh /, "rtk gh ")],
  [/^cargo\s+(\+\S+\s+)?(test|build|clippy|check|install|fmt)\b/, () => `rtk ${matchCommand}`],
  [/^cat\s+/, () => matchCommand.replace(/^cat /, "rtk read ")],
  [/^(rg|grep)\s+/, () => matchCommand.replace(/^(rg|grep) /, "rtk grep ")],
  [/^ls(\s|$)/, () => matchCommand.replace(/^ls/, "rtk ls")],
  [/^tree(\s|$)/, () => matchCommand.replace(/^tree/, "rtk tree")],
  [/^find\s+/, () => matchCommand.replace(/^find /, "rtk find ")],
  [/^diff\s+/, () => matchCommand.replace(/^diff /, "rtk diff ")],
  [/^(pnpm\s+)?(npx\s+)?vitest(\s+run)?\b/, () => matchCommand.replace(/^(pnpm\s+)?(npx\s+)?vitest(\s+run)?/, "rtk vitest run")],
  [/^pnpm\s+test\b/, () => matchCommand.replace(/^pnpm test/, "rtk vitest run")],
  [/^npm\s+test\b/, () => matchCommand.replace(/^npm test/, "rtk npm test")],
  [/^npm\s+run\s+/, () => matchCommand.replace(/^npm run /, "rtk npm ")],
  [/^(npx\s+)?vue-tsc\b/, () => matchCommand.replace(/^(npx\s+)?vue-tsc/, "rtk tsc")],
  [/^pnpm\s+tsc\b/, () => matchCommand.replace(/^pnpm tsc/, "rtk tsc")],
  [/^(npx\s+)?tsc\b/, () => matchCommand.replace(/^(npx\s+)?tsc/, "rtk tsc")],
  [/^pnpm\s+lint\b/, () => matchCommand.replace(/^pnpm lint/, "rtk lint")],
  [/^(npx\s+)?eslint\b/, () => matchCommand.replace(/^(npx\s+)?eslint/, "rtk lint")],
  [/^(npx\s+)?prettier\b/, () => matchCommand.replace(/^(npx\s+)?prettier/, "rtk prettier")],
  [/^(npx\s+)?playwright\b/, () => matchCommand.replace(/^(npx\s+)?playwright/, "rtk playwright")],
  [/^pnpm\s+playwright\b/, () => matchCommand.replace(/^pnpm playwright/, "rtk playwright")],
  [/^(npx\s+)?prisma\b/, () => matchCommand.replace(/^(npx\s+)?prisma/, "rtk prisma")],
  [/^curl\s+/, () => matchCommand.replace(/^curl /, "rtk curl ")],
  [/^wget\s+/, () => matchCommand.replace(/^wget /, "rtk wget ")],
  [/^pnpm\s+(list|ls|outdated)\b/, () => matchCommand.replace(/^pnpm /, "rtk pnpm ")],
  [/^pytest(\s|$)/, () => matchCommand.replace(/^pytest/, "rtk pytest")],
  [/^python\s+-m\s+pytest\b/, () => matchCommand.replace(/^python -m pytest/, "rtk pytest")],
  [/^ruff\s+(check|format)\b/, () => matchCommand.replace(/^ruff /, "rtk ruff ")],
  [/^pip\s+(list|outdated|install|show)\b/, () => matchCommand.replace(/^pip /, "rtk pip ")],
  [/^uv\s+pip\s+(list|outdated|install|show)\b/, () => matchCommand.replace(/^uv pip /, "rtk pip ")],
  [/^mypy(\s|$)/, () => matchCommand.replace(/^mypy/, "rtk mypy")],
  [/^python\s+-m\s+mypy\b/, () => matchCommand.replace(/^python -m mypy/, "rtk mypy")],
  [/^go\s+test\b/, () => matchCommand.replace(/^go test/, "rtk go test")],
  [/^go\s+build\b/, () => matchCommand.replace(/^go build/, "rtk go build")],
  [/^go\s+vet\b/, () => matchCommand.replace(/^go vet/, "rtk go vet")],
  [/^golangci-lint\b/, () => matchCommand.replace(/^golangci-lint/, "rtk golangci-lint")],
]);

if (!rewritten) {
  rewritten = rewriteDocker(matchCommand);
}
if (!rewritten) {
  rewritten = rewriteKubectl(matchCommand);
}
if (!rewritten) {
  rewritten = rewriteHead(matchCommand);
}

if (!rewritten) {
  process.exit(0);
}

const output = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    permissionDecisionReason: "RTK auto-rewrite",
    updatedInput: {
      ...input.tool_input,
      command: `${envPrefix}${rewritten}`,
    },
  },
};

process.stdout.write(`${JSON.stringify(output)}\n`);

function rewriteWithPrefix(matchCommand, envPrefix, originalCommand, rules) {
  for (const [pattern, build] of rules) {
    if (pattern.test(matchCommand)) {
      return build(originalCommand);
    }
  }
  return "";
}

function rewriteDocker(command) {
  if (/^docker\s+compose\s+(ps|logs|build)\b/.test(command)) {
    return command.replace(/^docker /, "rtk docker ");
  }
  if (/^docker\s+(ps|images|logs|run|build|exec)\b/.test(command)) {
    return command.replace(/^docker /, "rtk docker ");
  }
  return "";
}

function rewriteKubectl(command) {
  if (/^kubectl\s+(get|logs|describe|apply)\b/.test(command)) {
    return command.replace(/^kubectl /, "rtk kubectl ");
  }
  return "";
}

function rewriteHead(command) {
  let match = command.match(/^head\s+-([0-9]+)\s+(.+)$/);
  if (match) {
    return `rtk read ${match[2]} --max-lines ${match[1]}`;
  }

  match = command.match(/^head\s+--lines=([0-9]+)\s+(.+)$/);
  if (match) {
    return `rtk read ${match[2]} --max-lines ${match[1]}`;
  }

  return "";
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], { stdio: "ignore" });
  return result.status === 0;
}

async function readJsonFromStdin() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.trim() ? JSON.parse(data) : {};
}
