/**
 * Sorts a MIDI collection into rhythm folders by reading each file's drum track.
 * Usage: npx tsx .tmp-re/catalog-midis.ts <source> <dest> [--copy]
 * Without --copy only writes catalogo.csv and prints the counts.
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { extractMidiDrumScore, parseMidiFile } from "../web/src/rhythmConverter/midiDrumScore";
import { drumClass } from "../web/src/rhythmConverter/sectionSuggest";

const [src, dest, flag] = process.argv.slice(2);
if (!src || !dest) throw new Error("usage: catalog-midis <source> <dest> [--copy]");
const COPY = flag === "--copy";

const CATEGORIES = {
  error: "99 Erro de Leitura",
  noDrums: "00 Sem Bateria",
  ballad: "01 Balada (ate 80 BPM)",
  medium: "02 Pop-Rock Medio (80-115 BPM)",
  upbeat: "03 Pop-Rock Animado (115-150 BPM)",
  fast: "04 Rapido - Punk - Metal (150+ BPM)",
  shuffle: "05 Shuffle - Swing - Blues (tercinado)",
  dance: "06 Dance - Disco (bumbo 4 tempos)",
  latin: "07 Latino - Percussao",
  reggae: "08 Reggae",
  waltz: "09 Valsa (3-4)",
  compound: "10 Compasso 6-8 e 12-8",
  duple: "11 Binario 2-4 (Marcha - Polka - Forro)",
  odd: "12 Compasso Irregular (5-4, 7-8...)",
} as const;

/** Bongos, congas, timbales, agogo, guiro, claves, cuica (not shakers, maracas or cowbell). */
const LATIN = new Set([60, 61, 62, 63, 64, 65, 66, 67, 68, 73, 74, 75, 78, 79]);
const SNARE = new Set([37, 38, 39, 40]);

interface Result {
  file: string;
  category: string;
  meter: string;
  bpm: number;
  drumBars: number;
  swing: number;
  latin: number;
  fourFloor: number;
  oneDrop: number;
}

function near(x: number, target: number, tol = 0.05): boolean {
  return Math.abs(x - target) <= tol;
}

function classify(bytes: Uint8Array): Omit<Result, "file"> {
  const score = extractMidiDrumScore(parseMidiFile(bytes));
  const bars = score.bars.filter((b) => b.hits.length >= 2);
  const empty = { meter: "", bpm: 0, drumBars: bars.length, swing: 0, latin: 0, fourFloor: 0, oneDrop: 0 };
  if (bars.length < 4) return { ...empty, category: CATEGORIES.noDrums };

  const meterCount = new Map<string, number>();
  for (const b of bars) meterCount.set(`${b.numerator}/${b.denominator}`, (meterCount.get(`${b.numerator}/${b.denominator}`) ?? 0) + 1);
  const meter = [...meterCount].sort((a, b) => b[1] - a[1])[0]![0];
  const tempos = bars.map((b) => b.tempo).sort((a, b) => a - b);
  let bpm = Math.round(tempos[Math.floor(tempos.length / 2)]!);
  if (meter === "2/2") bpm *= 2;

  let trip = 0;
  let straight = 0;
  let latinHits = 0;
  let allHits = 0;
  let fourFloorBars = 0;
  let oneDropBars = 0;
  let quadBars = 0;
  let latinBars = 0;
  for (const b of bars) {
    const beat = (score.ppq * 4) / b.denominator;
    const kicks = new Set<number>();
    const snares = new Set<number>();
    let barLatin = 0;
    for (const h of b.hits) {
      allHits++;
      if (LATIN.has(h.note)) {
        latinHits++;
        barLatin++;
      }
      const cls = drumClass(h.note);
      const pos = (h.tick % beat) / beat;
      const onBeat = pos < 0.06 || pos > 0.94;
      if (cls === "kick" && onBeat) kicks.add(Math.round(h.tick / beat) % b.numerator);
      if (SNARE.has(h.note) && onBeat) snares.add(Math.round(h.tick / beat) % b.numerator);
      if (cls === "hat" || cls === "cymbal" || cls === "snare") {
        if (near(pos, 1 / 3) || near(pos, 2 / 3)) trip++;
        else if (near(pos, 0.25) || near(pos, 0.5) || near(pos, 0.75)) straight++;
      }
    }
    if (b.numerator === 4 && b.denominator === 4) {
      quadBars++;
      if ([0, 1, 2, 3].every((i) => kicks.has(i))) fourFloorBars++;
      if (kicks.has(2) && snares.has(2) && !kicks.has(0) && !snares.has(1) && !snares.has(3)) oneDropBars++;
    }
    if (barLatin >= 2) latinBars++;
  }
  const swing = trip + straight ? trip / (trip + straight) : 0;
  const latin = allHits ? latinHits / allHits : 0;
  const fourFloor = quadBars ? fourFloorBars / quadBars : 0;
  const oneDrop = quadBars ? oneDropBars / quadBars : 0;
  const stats = { meter, bpm, drumBars: bars.length, swing, latin, fourFloor, oneDrop };

  const [num, den] = meter.split("/").map(Number) as [number, number];
  let category: string;
  if (num === 3 && den === 4) category = CATEGORIES.waltz;
  else if (den === 8 && (num === 6 || num === 9 || num === 12)) category = CATEGORIES.compound;
  else if ((num === 2 && den === 4) || (num === 2 && den === 2 && bpm < 0)) category = CATEGORIES.duple;
  else if (!(num === 4 && den === 4) && !(num === 2 && den === 2)) category = CATEGORIES.odd;
  else if (oneDrop > 0.4) category = CATEGORIES.reggae;
  else if (latin > 0.15 && latinBars / bars.length > 0.4) category = CATEGORIES.latin;
  else if (swing > 0.55 && trip >= 32) category = CATEGORIES.shuffle;
  else if (fourFloor > 0.6 && bpm >= 108 && bpm <= 140) category = CATEGORIES.dance;
  else if (bpm < 80) category = CATEGORIES.ballad;
  else if (bpm < 115) category = CATEGORIES.medium;
  else if (bpm < 150) category = CATEGORIES.upbeat;
  else category = CATEGORIES.fast;
  return { ...stats, category };
}

async function listMidis(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMidis(full)));
    else if (/\.midi?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function uniqueTarget(dir: string, name: string, used: Set<string>): string {
  const ext = extname(name);
  const stem = basename(name, ext);
  let candidate = name;
  for (let i = 2; used.has(join(dir, candidate).toLowerCase()) || existsSync(join(dir, candidate)); i++) {
    candidate = `${stem} (${i})${ext}`;
  }
  used.add(join(dir, candidate).toLowerCase());
  return join(dir, candidate);
}

const files = await listMidis(src);
const results: Result[] = [];
const counts = new Map<string, number>();
const used = new Set<string>();
let done = 0;
for (const file of files) {
  let r: Omit<Result, "file">;
  try {
    r = classify(new Uint8Array(await readFile(file)));
  } catch {
    r = { category: CATEGORIES.error, meter: "", bpm: 0, drumBars: 0, swing: 0, latin: 0, fourFloor: 0, oneDrop: 0 };
  }
  results.push({ file, ...r });
  counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  if (COPY) {
    const dir = join(dest, r.category);
    await mkdir(dir, { recursive: true });
    await copyFile(file, uniqueTarget(dir, basename(file), used));
  }
  if (++done % 5000 === 0) console.log(`${done}/${files.length}`);
}

await mkdir(dest, { recursive: true });
const csv = [
  "arquivo;categoria;compasso;bpm;compassos_com_bateria;swing;latino;bumbo_4_tempos;one_drop",
  ...results.map((r) =>
    [r.file.slice(src.length + 1), r.category, r.meter, r.bpm, r.drumBars, r.swing.toFixed(2), r.latin.toFixed(2), r.fourFloor.toFixed(2), r.oneDrop.toFixed(2)].join(";"),
  ),
].join("\r\n");
await writeFile(join(dest, "catalogo.csv"), "\uFEFF" + csv, "utf8");
for (const [c, n] of [...counts].sort()) console.log(`${String(n).padStart(6)}  ${c}`);
console.log(`${files.length} files${COPY ? " copied" : " (dry run)"}`);
