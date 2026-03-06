#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const installScript = join(__dirname, "..", "install.sh");

if (!existsSync(installScript)) {
  console.error("[dgk-claude] install.sh not found. Please reinstall: npx dgk-claude");
  process.exit(1);
}

try {
  execFileSync("bash", [installScript], { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
