#!/usr/bin/env node
/**
 * Create a test license key.
 *
 * Usage:
 *   npx tsx server/create-license.ts --days 30 --note "beta alice"
 *   npx tsx server/create-license.ts --days 7
 */
import { createLicense } from "./licenses.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

const days = Number(arg("--days") || "30");
const note = arg("--note");

if (!Number.isFinite(days) || days < 1) {
  console.error("Usage: tsx server/create-license.ts --days 30 [--note \"label\"]");
  process.exit(1);
}

try {
  const { record, key } = createLicense({ days, note });
  console.log("License created");
  console.log(`  id:        ${record.id}`);
  console.log(`  expires:   ${record.expiresAt}`);
  if (record.note) console.log(`  note:      ${record.note}`);
  console.log(`  key:       ${key}`);
  console.log("");
  console.log("Give the key to the tester. Stored hashed in data/licenses.json");
} catch (e) {
  console.error(String(e));
  process.exit(1);
}
