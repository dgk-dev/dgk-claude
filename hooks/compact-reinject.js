#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const teamsDir = path.join(os.homedir(), ".claude", "teams");
if (!fs.existsSync(teamsDir)) {
  process.exit(0);
}

const teamEntries = fs.readdirSync(teamsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
if (teamEntries.length === 0) {
  process.exit(0);
}

const retResearchDir = path.join(os.tmpdir(), "ret-research");
const lines = [];
for (const entry of teamEntries) {
  const teamName = entry.name;
  lines.push(`[COMPACT restore] active team: ${teamName}`);
  lines.push(`team config: ${path.join(teamsDir, teamName, "config.json")}`);

  const decisionsPath = path.join(retResearchDir, teamName, "decisions.md");
  if (fs.existsSync(decisionsPath)) {
    lines.push(`decisions file: ${decisionsPath}`);
  }

  const reportDir = path.join(retResearchDir, teamName);
  if (fs.existsSync(reportDir) && fs.statSync(reportDir).isDirectory()) {
    lines.push(`team reports: ${reportDir}`);
  }
}

lines.push("Continue the previous team task and read decisions.md to restore context.");
process.stdout.write(`${lines.join("\n")}\n`);
