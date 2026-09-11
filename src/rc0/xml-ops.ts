/** String-based XML helpers for non-standard RC0 (content may sit outside root). */

export function findSection(
  xml: string,
  tag: string,
  from = 0,
  to = xml.length,
): [number, number] | null {
  const open = `<${tag}`;
  let start = -1;
  let i = from;
  while (i < to) {
    const at = xml.indexOf(open, i);
    if (at < 0 || at >= to) return null;
    const next = xml[at + open.length];
    if (next === ">" || next === " " || next === "\t" || next === "\r" || next === "\n") {
      start = at;
      break;
    }
    i = at + open.length;
  }
  if (start < 0) return null;

  const close = `</${tag}>`;
  const end = xml.indexOf(close, start);
  if (end < 0 || end >= to) return null;
  return [start, end + close.length];
}

export function getTagContent(
  xml: string,
  tag: string,
  from = 0,
  to = xml.length,
): string | null {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open, from);
  if (start < 0 || start >= to) return null;
  const contentStart = start + open.length;
  const end = xml.indexOf(close, contentStart);
  if (end < 0 || end > to) return null;
  return xml.slice(contentStart, end);
}

/** Replace first `<tag>…</tag>` content inside [from,to). Returns new xml or null. */
export function setTagContent(
  xml: string,
  tag: string,
  value: string,
  from = 0,
  to = xml.length,
): string | null {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open, from);
  if (start < 0 || start >= to) return null;
  const contentStart = start + open.length;
  const end = xml.indexOf(close, contentStart);
  if (end < 0 || end > to) return null;
  return xml.slice(0, contentStart) + value + xml.slice(end);
}

export function extractCount(xml: string): string {
  const m = xml.match(/<count>([0-9A-Fa-f]+)<\/count>/);
  return m ? m[1] : "0000";
}

export function parseHexCount(count: string): number {
  return parseInt(count.replace(/[^0-9A-Fa-f]/gi, "") || "0", 16);
}

export function formatHexCount(n: number, width = 4): string {
  const clamped = ((n % 0x10000) + 0x10000) % 0x10000;
  return clamped.toString(16).toUpperCase().padStart(width, "0");
}

export function incrementCount(xml: string): string {
  const current = extractCount(xml);
  const next = formatHexCount(parseHexCount(current) + 1);
  if (/<count>[0-9A-Fa-f]+<\/count>/.test(xml)) {
    return xml.replace(/<count>[0-9A-Fa-f]+<\/count>/, `<count>${next}</count>`);
  }
  return `${xml.trimEnd()}\n<count>${next}</count>\n`;
}

export function activeSide(countA: string, countB: string): "a" | "b" {
  return parseHexCount(countB) > parseHexCount(countA) ? "b" : "a";
}
