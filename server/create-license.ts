#!/usr/bin/env node
/**
 * Create a license key. Keys never expire unless --days is given.
 *
 * Usage:
 *   npx tsx server/create-license.ts --note "buyer@example.com-Name"
 *   npx tsx server/create-license.ts --days 7 --note "trial alice"
 */
import { recordIssuedLicense } from "./issued-licenses.js";
import { createLicense } from "./licenses.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

const daysArg = arg("--days");
const days = daysArg === undefined ? undefined : Number(daysArg);
const note = arg("--note");

if (days !== undefined && (!Number.isFinite(days) || days < 1)) {
  console.error("Usage: tsx server/create-license.ts [--days 30] [--note \"label\"]");
  process.exit(1);
}

try {
  const { record, key } = createLicense({ days, note });
  recordIssuedLicense({
    id: record.id,
    key,
    note: record.note,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  });
  console.log("License created");
  console.log(`  id:        ${record.id}`);
  console.log(`  expires:   ${record.expiresAt ?? "never"}`);
  if (record.note) console.log(`  note:      ${record.note}`);
  console.log(`  key:       ${key}`);
  console.log("");
  console.log("Key saved in data/issued-licenses.json (this copy stays on your computer).");
  console.log("Hash saved in data/licenses.json (this is the file to commit).");
} catch (e) {
  console.error(String(e));
  process.exit(1);
}
