import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "../web/public/play-drum/presets.json");

const STD = [36, 38, 39, 37, 42, 46, 44, 56, 41, 43, 45, 47, 49, 51, 52, 53];
const LATIN = [36, 38, 75, 37, 63, 64, 62, 56, 65, 66, 60, 61, 49, 76, 77, 54];
const PERC = [36, 75, 69, 70, 63, 64, 80, 81, 73, 74, 67, 68, 54, 76, 77, 56];

function ov(hits) {
  return Object.fromEntries(
    Object.entries(hits).map(([k, v]) => [String(k), { bpm: null, meter: null, hitsPerBar: v }]),
  );
}

function p(id, name, { notes = STD, bpm, meter = "4/4", velocity = 100, hits }) {
  return {
    id,
    name,
    source: "native",
    updatedAt: "2026-09-13T00:00:00.000Z",
    payload: { notes, bpm, meter, velocity, overrides: ov(hits) },
  };
}

const extras = [
  p("pop-punk", "Pop Punk", { bpm: 178, velocity: 112, hits: { 0: 4, 1: 2, 4: 8, 12: 1 } }),
  p("post-punk", "Post Punk", { bpm: 142, velocity: 96, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("shoegaze", "Shoegaze", { bpm: 88, velocity: 82, hits: { 0: 4, 1: 2, 13: 8 } }),
  p("emo", "Emo", { bpm: 164, velocity: 104, hits: { 0: 4, 1: 2, 4: 8, 12: 1 } }),
  p("hardcore", "Hardcore", { bpm: 208, velocity: 120, hits: { 0: 8, 1: 4, 4: 16 } }),
  p("alt-rock", "Alt Rock", { bpm: 118, velocity: 100, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("southern-rock", "Southern Rock", { bpm: 112, velocity: 98, hits: { 0: 2, 1: 2, 13: 8 } }),
  p("blues-rock", "Blues Rock", { bpm: 96, velocity: 94, hits: { 0: 2, 1: 2, 4: 8, 13: 4 } }),
  p("psych-rock", "Psych Rock", { bpm: 108, velocity: 90, hits: { 0: 4, 1: 2, 13: 4 } }),
  p("stoner", "Stoner", { bpm: 72, velocity: 110, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("post-rock", "Post Rock", { bpm: 78, velocity: 80, hits: { 0: 2, 13: 8 } }),
  p("slowcore", "Slowcore", { bpm: 58, velocity: 76, hits: { 0: 2, 1: 1, 4: 4 } }),
  p("dream-pop", "Dream Pop", { bpm: 92, velocity: 78, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("new-jack", "New Jack Swing", { bpm: 108, velocity: 104, hits: { 0: 4, 1: 2, 2: 2, 4: 8 } }),
  p("acid-house", "Acid House", { bpm: 128, velocity: 108, hits: { 0: 4, 2: 2, 4: 16 } }),
  p("minimal-techno", "Minimal Techno", { bpm: 128, velocity: 96, hits: { 0: 4, 4: 8 } }),
  p("hardstyle", "Hardstyle", { bpm: 150, velocity: 120, hits: { 0: 4, 1: 2, 4: 16 } }),
  p("gabber", "Gabber", { bpm: 180, velocity: 127, hits: { 0: 8, 4: 16 } }),
  p("future-bass", "Future Bass", { bpm: 150, velocity: 102, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("uk-drill", "UK Drill", { bpm: 142, velocity: 108, hits: { 0: 3, 1: 2, 4: 16 } }),
  p("grime", "Grime", { bpm: 140, velocity: 110, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("amapiano", "Amapiano", { bpm: 112, velocity: 96, hits: { 0: 4, 1: 1, 4: 8, 8: 2 } }),
  p("afro-house", "Afro House", { bpm: 120, velocity: 102, hits: { 0: 4, 4: 16, 7: 4 } }),
  p("gqom", "Gqom", { bpm: 127, velocity: 114, hits: { 0: 4, 1: 1, 4: 8 } }),
  p("italo-disco", "Italo Disco", { bpm: 124, velocity: 104, hits: { 0: 4, 2: 2, 4: 8 } }),
  p("eurodance", "Eurodance", { bpm: 138, velocity: 110, hits: { 0: 4, 2: 2, 4: 16 } }),
  p("synthpop", "Synthpop", { bpm: 118, velocity: 96, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("city-pop", "City Pop", { bpm: 108, velocity: 90, hits: { 0: 4, 1: 2, 4: 8, 13: 4 } }),
  p("vaporwave", "Vaporwave", { bpm: 80, velocity: 78, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("downtempo", "Downtempo", { bpm: 90, velocity: 82, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("breaks", "Breaks", { bpm: 132, velocity: 108, hits: { 0: 4, 1: 4, 4: 8 } }),
  p("liquid-dnb", "Liquid DnB", { bpm: 172, velocity: 100, hits: { 0: 4, 1: 2, 4: 16 } }),
  p("neurofunk", "Neurofunk", { bpm: 174, velocity: 114, hits: { 0: 4, 1: 2, 4: 16 } }),
  p("moombahton", "Moombahton", { bpm: 108, velocity: 104, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("dembow", "Dembow", { bpm: 96, velocity: 110, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("jersey-club", "Jersey Club", { bpm: 140, velocity: 112, hits: { 0: 8, 1: 4, 4: 8 } }),
  p("footwork", "Footwork", { bpm: 160, velocity: 108, hits: { 0: 8, 4: 16 } }),
  p("idm", "IDM", { bpm: 136, velocity: 92, hits: { 0: 3, 1: 5, 4: 16 } }),
  p("salsa", "Salsa", { notes: LATIN, bpm: 200, velocity: 108, hits: { 0: 4, 2: 3, 4: 8, 7: 8, 8: 4 } }),
  p("merengue", "Merengue", { notes: LATIN, bpm: 152, velocity: 112, hits: { 0: 8, 4: 8, 15: 8 } }),
  p("cha-cha", "Cha-Cha", { notes: LATIN, bpm: 120, velocity: 98, hits: { 0: 4, 4: 8, 7: 4 } }),
  p("mambo", "Mambo", { notes: LATIN, bpm: 184, velocity: 110, hits: { 0: 4, 7: 8, 8: 4 } }),
  p("bachata", "Bachata", { notes: LATIN, bpm: 128, velocity: 94, hits: { 0: 2, 1: 2, 15: 8 } }),
  p("tango", "Tango", { bpm: 66, velocity: 100, hits: { 0: 2, 1: 2, 3: 4 } }),
  p("rumba", "Rumba", { notes: LATIN, bpm: 100, velocity: 96, hits: { 0: 2, 2: 3, 4: 8 } }),
  p("bolero", "Bolero", { bpm: 78, velocity: 80, hits: { 0: 2, 1: 2, 13: 4 } }),
  p("son-cubano", "Son Cubano", { notes: LATIN, bpm: 160, velocity: 100, hits: { 0: 4, 2: 3, 4: 8 } }),
  p("samba-reggae", "Samba Reggae", { notes: LATIN, bpm: 100, velocity: 104, hits: { 0: 4, 1: 2, 4: 8, 7: 4 } }),
  p("baiao", "Baiao", { notes: LATIN, bpm: 110, velocity: 102, hits: { 0: 2, 1: 2, 7: 8, 13: 4 } }),
  p("forro", "Forro", { notes: LATIN, bpm: 124, velocity: 104, hits: { 0: 4, 7: 8, 15: 8 } }),
  p("axe", "Axe", { notes: LATIN, bpm: 128, velocity: 110, hits: { 0: 4, 1: 2, 15: 8 } }),
  p("maracatu", "Maracatu", { notes: LATIN, bpm: 88, velocity: 112, hits: { 0: 4, 1: 2, 8: 8 } }),
  p("frevo", "Frevo", { notes: LATIN, bpm: 144, velocity: 108, hits: { 0: 4, 1: 4, 15: 8 } }),
  p("pagode", "Pagode", { notes: LATIN, bpm: 98, velocity: 96, hits: { 0: 2, 1: 2, 15: 8, 4: 8 } }),
  p("mpb", "MPB", { bpm: 96, velocity: 88, hits: { 0: 2, 1: 2, 4: 8, 13: 4 } }),
  p("ska", "Ska", { bpm: 168, velocity: 104, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("rocksteady", "Rocksteady", { bpm: 88, velocity: 90, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("dub", "Dub", { bpm: 76, velocity: 86, hits: { 0: 2, 1: 2, 3: 4, 4: 4 } }),
  p("calypso", "Calypso", { notes: LATIN, bpm: 116, velocity: 100, hits: { 0: 4, 1: 2, 15: 8 } }),
  p("soca", "Soca", { notes: LATIN, bpm: 136, velocity: 112, hits: { 0: 4, 1: 2, 15: 16 } }),
  p("zouk", "Zouk", { bpm: 98, velocity: 90, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("kizomba", "Kizomba", { bpm: 94, velocity: 84, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("highlife", "Highlife", { notes: LATIN, bpm: 118, velocity: 96, hits: { 0: 4, 1: 2, 4: 8, 7: 4 } }),
  p("soukous", "Soukous", { notes: LATIN, bpm: 128, velocity: 100, hits: { 0: 4, 1: 2, 4: 16 } }),
  p("bhangra", "Bhangra", { bpm: 140, velocity: 108, hits: { 0: 4, 1: 4, 4: 8, 7: 8 } }),
  p("bollywood", "Bollywood", { bpm: 110, velocity: 100, hits: { 0: 4, 1: 2, 4: 8, 7: 4 } }),
  p("flamenco", "Flamenco", { bpm: 126, meter: "3/4", velocity: 104, hits: { 0: 3, 1: 3, 4: 6 } }),
  p("jig", "Jig", { bpm: 126, meter: "6/8", velocity: 100, hits: { 0: 2, 1: 2, 4: 6 } }),
  p("reel", "Reel", { bpm: 112, velocity: 98, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("bluegrass", "Bluegrass", { bpm: 144, velocity: 104, hits: { 0: 4, 1: 2, 3: 8 } }),
  p("honky-tonk", "Honky Tonk", { bpm: 118, velocity: 100, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("two-step", "Two Step", { bpm: 126, velocity: 102, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("zydeco", "Zydeco", { bpm: 132, velocity: 108, hits: { 0: 4, 1: 2, 4: 8, 7: 8 } }),
  p("cajun", "Cajun", { bpm: 120, velocity: 98, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("nashville", "Nashville", { bpm: 100, velocity: 92, hits: { 0: 2, 1: 2, 4: 8, 13: 4 } }),
  p("bop", "Bop", { bpm: 220, velocity: 88, hits: { 0: 1, 1: 2, 13: 8 } }),
  p("cool-jazz", "Cool Jazz", { bpm: 108, velocity: 78, hits: { 0: 1, 1: 2, 13: 4 } }),
  p("latin-jazz", "Latin Jazz", { notes: LATIN, bpm: 168, velocity: 96, hits: { 0: 4, 2: 3, 13: 8 } }),
  p("second-line", "Second Line", { bpm: 108, velocity: 104, hits: { 0: 4, 1: 4, 4: 8, 8: 4 } }),
  p("new-orleans", "New Orleans", { bpm: 96, velocity: 100, hits: { 0: 2, 1: 2, 4: 8, 7: 4 } }),
  p("death-metal", "Death Metal", { bpm: 200, velocity: 124, hits: { 0: 16, 1: 2, 4: 16 } }),
  p("black-metal", "Black Metal", { bpm: 186, velocity: 118, hits: { 0: 16, 1: 2, 4: 16 } }),
  p("power-metal", "Power Metal", { bpm: 162, velocity: 114, hits: { 0: 8, 1: 2, 4: 8, 12: 1 } }),
  p("nu-metal", "Nu Metal", { bpm: 94, velocity: 112, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("djent", "Djent", { bpm: 140, velocity: 116, hits: { 0: 8, 1: 2, 4: 16 } }),
  p("mazurka", "Mazurka", { bpm: 132, meter: "3/4", velocity: 90, hits: { 0: 3, 1: 1, 4: 6 } }),
  p("minuet", "Minuet", { bpm: 84, meter: "3/4", velocity: 82, hits: { 0: 3, 4: 6 } }),
  p("tarantella", "Tarantella", { bpm: 144, meter: "6/8", velocity: 104, hits: { 0: 2, 1: 2, 4: 6 } }),
  p("compound-rock", "Compound Rock", { bpm: 118, meter: "6/8", velocity: 104, hits: { 0: 2, 1: 2, 4: 6 } }),
  p("kick-and-hats", "Kick and Hats", { bpm: 120, velocity: 100, hits: { 0: 4, 4: 16 } }),
  p("backbeat", "Backbeat", { bpm: 120, velocity: 108, hits: { 1: 2 } }),
  p("offbeat", "Offbeat", { bpm: 120, velocity: 96, hits: { 0: 2, 4: 8 } }),
  p("agogo-pulse", "Agogo Pulse", { notes: PERC, bpm: 118, velocity: 100, hits: { 0: 4, 10: 8, 11: 4 } }),
  p("maracas-16", "Maracas", { notes: PERC, bpm: 120, velocity: 88, hits: { 3: 16 } }),
  p("guiro-groove", "Guiro Groove", { notes: PERC, bpm: 108, velocity: 92, hits: { 0: 4, 8: 8, 9: 4 } }),
  p("woodblock", "Woodblock", { notes: PERC, bpm: 120, velocity: 96, hits: { 13: 8, 14: 4 } }),
  p("slow-jam", "Slow Jam", { bpm: 68, velocity: 86, hits: { 0: 2, 1: 2, 4: 8 } }),
  p("party-rock", "Party Rock", { bpm: 128, velocity: 110, hits: { 0: 4, 1: 2, 2: 2, 4: 8 } }),
  p("train-beat", "Train Beat", { bpm: 148, velocity: 104, hits: { 0: 4, 1: 8, 4: 8 } }),
  p("motorik", "Motorik", { bpm: 130, velocity: 94, hits: { 0: 4, 1: 2, 4: 8 } }),
  p("disco-hats", "Disco Hats", { bpm: 120, velocity: 100, hits: { 0: 4, 2: 2, 4: 16, 5: 4 } }),
];

const catalog = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const seen = new Set(catalog.presets.map((p) => p.id));
const names = new Set(catalog.presets.map((p) => p.name.toLowerCase()));
const added = [];
for (const preset of extras) {
  if (seen.has(preset.id) || names.has(preset.name.toLowerCase())) continue;
  seen.add(preset.id);
  names.add(preset.name.toLowerCase());
  added.push(preset);
}
catalog.presets.push(...added);
writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`added ${added.length}, total ${catalog.presets.length}`);
