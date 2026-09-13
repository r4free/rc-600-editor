/** Closed English set for the Play Drum rhythm gallery. */
export const DRUM_PRESET_CATEGORIES = [
  "Practice",
  "Rock",
  "Metal",
  "Punk",
  "Pop",
  "Funk & Soul",
  "Hip-Hop",
  "Electronic",
  "Latin",
  "World",
  "Jazz & Blues",
  "Folk",
] as const;

export type DrumPresetCategory = (typeof DRUM_PRESET_CATEGORIES)[number];

export const DEFAULT_DRUM_PRESET_CATEGORY: DrumPresetCategory = "Practice";

const CATEGORY_SET = new Set<string>(DRUM_PRESET_CATEGORIES);

export function isDrumPresetCategory(value: string): value is DrumPresetCategory {
  return CATEGORY_SET.has(value);
}

export function normalizeDrumPresetCategory(raw: unknown): DrumPresetCategory | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (isDrumPresetCategory(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return DRUM_PRESET_CATEGORIES.find((c) => c.toLowerCase() === lower) ?? null;
}

function hasPhrase(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return false;
  let from = 0;
  while (from <= h.length) {
    const i = h.indexOf(n, from);
    if (i < 0) return false;
    const before = i === 0 || !/[a-z0-9]/.test(h[i - 1] ?? "");
    const after = i + n.length === h.length || !/[a-z0-9]/.test(h[i + n.length] ?? "");
    if (before && after) return true;
    from = i + 1;
  }
  return false;
}

/** First matching rule wins — keep specific phrases ahead of broad ones (garage, rock, dub). */
const CATEGORY_RULES: { category: DrumPresetCategory; needles: readonly string[] }[] = [
  {
    category: "Practice",
    needles: [
      "default kit",
      "kick only",
      "hats only",
      "snare roll",
      "tom fill",
      "kick and hats",
      "break fill",
      "open hat groove",
      "ride groove",
      "rim groove",
      "cabasa",
      "claves",
      "agogo",
      "maracas",
      "guiro",
      "woodblock",
      "half time",
      "backbeat",
      "offbeat",
      "click",
    ],
  },
  {
    category: "Metal",
    needles: ["death metal", "black metal", "power metal", "nu metal", "double kick", "djent", "thrash", "doom", "metal"],
  },
  {
    category: "Punk",
    needles: ["pop punk", "post punk", "hardcore", "punk", "emo"],
  },
  {
    category: "Electronic",
    needles: [
      "four on the floor",
      "uk garage",
      "drum and bass",
      "liquid dnb",
      "tropical house",
      "deep house",
      "acid house",
      "afro house",
      "minimal techno",
      "italo disco",
      "disco clap",
      "disco hats",
      "cowbell disco",
      "ambient pulse",
      "future bass",
      "neurofunk",
      "moombahton",
      "footwork",
      "hardstyle",
      "gabber",
      "synthwave",
      "chillwave",
      "vaporwave",
      "downtempo",
      "breakbeat",
      "breaks",
      "dubstep",
      "techno",
      "trance",
      "house",
      "jungle",
      "big beat",
      "electro",
      "industrial",
      "eurodance",
      "disco",
      "idm",
      "amapiano",
      "gqom",
    ],
  },
  {
    category: "Hip-Hop",
    needles: [
      "boom bap",
      "lo-fi hop",
      "trip hop",
      "west coast",
      "trap bounce",
      "uk drill",
      "jersey club",
      "trap",
      "grime",
      "drill",
    ],
  },
  {
    category: "Latin",
    needles: [
      "bossa nova",
      "samba reggae",
      "son cubano",
      "latin jazz",
      "latin clave",
      "reggaeton",
      "merengue",
      "cha-cha",
      "bachata",
      "maracatu",
      "cumbia",
      "salsa",
      "mambo",
      "tango",
      "rumba",
      "bolero",
      "samba",
      "baiao",
      "forro",
      "pagode",
      "dembow",
      "conga",
      "timbale",
      "bongo",
      "frevo",
      "axe",
      "mpb",
      "latin",
    ],
  },
  {
    category: "World",
    needles: [
      "afrobeats",
      "afrobeat",
      "dancehall",
      "rocksteady",
      "highlife",
      "soukous",
      "bhangra",
      "bollywood",
      "kizomba",
      "calypso",
      "reggae",
      "ska",
      "soca",
      "zouk",
      "dub",
    ],
  },
  {
    category: "Funk & Soul",
    needles: [
      "new jack swing",
      "funk groove",
      "tight funk",
      "soul ballad",
      "r&b quiet",
      "slow jam",
      "motown",
      "gospel",
      "funk",
      "soul",
    ],
  },
  {
    category: "Rock",
    needles: ["blues rock"],
  },
  {
    category: "Jazz & Blues",
    needles: [
      "blues shuffle",
      "jazz ride",
      "cool jazz",
      "second line",
      "new orleans",
      "3/4 ballad",
      "shuffle",
      "swing",
      "fusion",
      "ballad",
      "bop",
      "jazz",
      "blues",
    ],
  },
  {
    category: "Folk",
    needles: [
      "country train",
      "honky tonk",
      "two step",
      "bluegrass",
      "nashville",
      "tarantella",
      "triangle waltz",
      "6/8 march",
      "flamenco",
      "mazurka",
      "minuet",
      "zydeco",
      "cajun",
      "waltz",
      "polka",
      "march",
      "jig",
      "reel",
      "folk",
    ],
  },
  {
    category: "Pop",
    needles: ["dream pop", "city pop", "synthpop", "tambourine pop", "new wave", "britpop"],
  },
  {
    category: "Rock",
    needles: [
      "garage rock",
      "indie rock",
      "hard rock",
      "soft rock",
      "slow rock",
      "pop rock",
      "alt rock",
      "post rock",
      "psych rock",
      "southern rock",
      "party rock",
      "surf beat",
      "train beat",
      "compound rock",
      "shoegaze",
      "slowcore",
      "motorik",
      "grunge",
      "stoner",
      "garage",
      "rock",
    ],
  },
];

export function inferDrumPresetCategory(name: string): DrumPresetCategory {
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_DRUM_PRESET_CATEGORY;
  for (const rule of CATEGORY_RULES) {
    if (rule.needles.some((needle) => hasPhrase(trimmed, needle))) return rule.category;
  }
  return DEFAULT_DRUM_PRESET_CATEGORY;
}

export function resolveDrumPresetCategory(raw: unknown, name: string): DrumPresetCategory {
  return normalizeDrumPresetCategory(raw) ?? inferDrumPresetCategory(name);
}

export function groupPresetsByCategory<T extends { category: DrumPresetCategory }>(
  presets: readonly T[],
): { category: DrumPresetCategory; presets: T[] }[] {
  const buckets = new Map<DrumPresetCategory, T[]>();
  for (const cat of DRUM_PRESET_CATEGORIES) buckets.set(cat, []);
  for (const preset of presets) {
    (buckets.get(preset.category) ?? buckets.get(DEFAULT_DRUM_PRESET_CATEGORY))!.push(preset);
  }
  return DRUM_PRESET_CATEGORIES.flatMap((category) => {
    const list = buckets.get(category) ?? [];
    return list.length > 0 ? [{ category, presets: list }] : [];
  });
}
