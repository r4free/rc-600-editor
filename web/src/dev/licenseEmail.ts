export interface LicenseEmailInput {
  name: string;
  key: string;
  startsAt?: string | null;
  expiresAt?: string | null;
}

const SITE_URL = "https://rc-600-editor.onrender.com";

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function validity(startsAt?: string | null, expiresAt?: string | null): string {
  if (startsAt && expiresAt) return `The license is valid from ${day(startsAt)} through ${day(expiresAt)}.`;
  if (startsAt) return `The license is valid from ${day(startsAt)} and does not expire.`;
  if (expiresAt) return `The license is valid through ${day(expiresAt)}.`;
  return "The license does not expire.";
}

export function licenseEmailSubject(): string {
  return "Your RC-600 Web Editor license key";
}

export function licenseEmailText({ name, key, startsAt, expiresAt }: LicenseEmailInput): string {
  const permanent = !startsAt && !expiresAt;
  return [
    `Dear ${name.trim()},`,
    "",
    `Thank you for supporting the RC-600 Web Editor. Here is your ${permanent ? "permanent " : ""}license key:`,
    "",
    key,
    "",
    `Open ${SITE_URL} in Chrome or Edge on a computer, enter the key, and choose Open editor. ${validity(startsAt, expiresAt)} Keep this email so you can sign in again later.`,
    "",
    "To edit your memories, put the RC-600 in USB Storage mode (MENU > USB > STORAGE ON), connect it to the computer, and open the ROLAND folder with Open folder.",
    "",
    `A short user guide is here: ${SITE_URL}/guia.html`,
    "",
    "If anything does not open, reply to this email and I will help.",
    "",
    "Best regards",
  ].join("\n");
}
