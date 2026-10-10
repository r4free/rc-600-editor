export interface LicenseEmailInput {
  name: string;
  key: string;
  plan?: "full" | "preview" | null;
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

export function licenseEmailSubject(plan?: "full" | "preview" | null): string {
  return plan === "preview"
    ? "Your RC-600 Web Editor preview key"
    : "Your RC-600 Web Editor license key";
}

export function licenseEmailText({ name, key, plan, startsAt, expiresAt }: LicenseEmailInput): string {
  const permanent = !startsAt && !expiresAt;
  const preview = plan === "preview";
  return [
    `Dear ${name.trim()},`,
    "",
    preview
      ? "Here is your preview key for the RC-600 Web Editor:"
      : `Thank you for supporting the RC-600 Web Editor. Here is your ${permanent ? "permanent " : ""}license key:`,
    "",
    key,
    "",
    `Open ${SITE_URL} in Chrome or Edge on a computer, enter the key, and choose Open editor. ${validity(startsAt, expiresAt)} Keep this email so you can sign in again later.`,
    "",
    preview
      ? "This key lets you look through the editor and play. Setlists and rhythm lists are not saved. Memories can be saved while editing offline, and saving is turned off while the RC-600 is connected."
      : "To edit your memories, put the RC-600 in USB Storage mode (MENU > USB > STORAGE ON), connect it to the computer, and open the ROLAND folder with Open folder.",
    "",
    `A short user guide is here: ${SITE_URL}/guia.html`,
    "",
    "If anything does not open, reply to this email and I will help.",
    "",
    "Best regards",
  ].join("\n");
}
