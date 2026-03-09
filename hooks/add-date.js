#!/usr/bin/env node

const now = new Date();
const currentDate = now.toISOString().slice(0, 10);
const currentYear = String(now.getFullYear());
const currentTime = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
}).format(now);

process.stdout.write(
  `[CONTEXT] Today is ${currentDate} (${currentTime}). Current year is ${currentYear}. Always use ${currentYear} for searches and documentation.\n`,
);
