import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function runNode(scriptPath, args = [], options = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
    input: options.input,
  });
}

test("installer migrates legacy shell hook commands to node hook commands", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "dgk-home-"));
  const claudeDir = path.join(homeDir, ".claude");
  fs.mkdirSync(path.join(claudeDir, "hooks"), { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              { type: "command", command: "echo existing" },
              { type: "command", command: `bash ${path.join(homeDir, ".claude", "hooks", "bash-guard.sh")}` },
            ],
          },
        ],
      },
    }),
  );

  const result = runNode(path.join(repoRoot, "bin", "dgk-claude.js"), ["--yes", "--skip-glm-review"], {
    env: { HOME: homeDir },
  });

  assert.equal(result.status, 0, result.stderr);
  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8"));
  const bashHooks = settings.hooks.PreToolUse.find((entry) => entry.matcher === "Bash").hooks;
  assert.ok(bashHooks.some((hook) => hook.command === "echo existing"));
  assert.ok(bashHooks.some((hook) => hook.command === 'node "$HOME/.claude/hooks/bash-guard.js"'));
  assert.ok(bashHooks.every((hook) => !hook.command.includes("bash-guard.sh")));
  assert.ok(fs.existsSync(path.join(claudeDir, "hooks", "bash-guard.js")));
});

test("handoff hook loads STATE.md for session recovery", () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "dgk-project-"));
  fs.writeFileSync(path.join(projectDir, "STATE.md"), "Current phase: stabilize installer\n");

  const result = runNode(path.join(repoRoot, "hooks", "handoff-load.js"), [], {
    input: JSON.stringify({ cwd: projectDir }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Current phase: stabilize installer/);
  assert.match(result.stdout, /\[STATE\]/);
});

test("bash guard blocks destructive commands", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "dgk-guard-"));
  const result = runNode(path.join(repoRoot, "hooks", "bash-guard.js"), [], {
    env: { HOME: homeDir },
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "git push --force origin main" },
    }),
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /force push 금지/);
  const logPath = path.join(homeDir, ".claude", "logs", "blocked.log");
  assert.ok(fs.existsSync(logPath));
});

test("rtk rewrite preserves env prefix and rewrites supported commands", () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "dgk-bin-"));
  const rtkPath = path.join(binDir, "rtk");
  fs.writeFileSync(rtkPath, "#!/usr/bin/env bash\nexit 0\n");
  fs.chmodSync(rtkPath, 0o755);

  const result = runNode(path.join(repoRoot, "hooks", "rtk-rewrite.js"), [], {
    env: { PATH: `${binDir}:${process.env.PATH}` },
    input: JSON.stringify({
      tool_input: { command: "FOO=bar npx tsc --noEmit" },
    }),
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.updatedInput.command, "FOO=bar rtk tsc --noEmit");
});

test("--check-ret reports /ret preflight status and detects configured MCPs", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "dgk-ret-home-"));
  fs.writeFileSync(
    path.join(homeDir, ".claude.json"),
    JSON.stringify({
      mcpServers: {
        "context7-mcp": {},
        jina: {},
        "sequential-thinking": {},
      },
    }),
  );

  const result = runNode(path.join(repoRoot, "bin", "dgk-claude.js"), ["--check-ret"], {
    env: {
      DGK_CLAUDE_TEST_COMMANDS: JSON.stringify({ claude: true, tmux: false }),
      HOME: homeDir,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /tmux: missing/);
  assert.match(result.stdout, /Context7 MCP: configured/);
  assert.match(result.stdout, /Jina MCP: configured/);
  assert.match(result.stdout, /Sequential Thinking MCP: configured/);
  assert.match(result.stdout, /Agent Teams: manual check required/);
});

test("--install-system-deps installs tmux when a supported package manager is available", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "dgk-ret-install-home-"));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "dgk-ret-bin-"));
  const installLog = path.join(binDir, "install.log");
  const whichPath = path.join(binDir, "which");
  const sudoPath = path.join(binDir, "sudo");
  const aptGetPath = path.join(binDir, "apt-get");

  fs.writeFileSync(
    whichPath,
    `#!/usr/bin/env bash
target="$1"
if [ -x "$(dirname "$0")/$target" ]; then
  echo "$(dirname "$0")/$target"
  exit 0
fi
exit 1
`,
  );
  fs.writeFileSync(
    sudoPath,
    `#!/usr/bin/env bash
"$@"
`,
  );
  fs.writeFileSync(
    aptGetPath,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${installLog}"
cat > "$(dirname "$0")/tmux" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$(dirname "$0")/tmux"
`,
  );
  fs.chmodSync(whichPath, 0o755);
  fs.chmodSync(sudoPath, 0o755);
  fs.chmodSync(aptGetPath, 0o755);

  const result = runNode(path.join(repoRoot, "bin", "dgk-claude.js"), ["--check-ret", "--install-system-deps"], {
    env: {
      HOME: homeDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(binDir, "tmux")));
  assert.match(fs.readFileSync(installLog, "utf8"), /install -y tmux/);
  assert.match(result.stdout, /tmux 자동 설치 시도/);
});
