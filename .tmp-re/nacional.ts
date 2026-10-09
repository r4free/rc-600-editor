/**
 * Splits the rhythm catalog into Nacional / Internacional by the text inside each MIDI.
 * Usage: npx tsx .tmp-re/nacional.ts "<Por Ritmo dir>" [--move]
 * Without --move only writes nacional.csv and prints counts and samples.
 */
import { mkdir, readdir, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const [root, flag] = process.argv.slice(2);
if (!root) throw new Error("usage: nacional <Por Ritmo dir> [--move]");
const MOVE = flag === "--move";
const NAT = "Nacional";
const INT = "Internacional";

/** Words that are Portuguese and not common in Spanish, Italian, French or English. */
const PT_WORDS = new Set(
  (
    "nao voce voces meu minha minhas meus pra tudo muito muita coracao saudade saudades quero teu tua teus tuas " +
    "entao tambem ninguem amanha sozinho sozinha beijo beijar estou vou vai isso essa esse aqui uma nosso nossa " +
    "paixao cancao canção sonho sonhar ilusao solidao felicidade gostoso gostosa menina menino namorada namorado " +
    "saudosa voltar chorar chora choro deixa deixar sempre agora longe jeito tchau obrigado obrigada cade " +
    "fazer olhar olhos boca beleza alegria tristeza verao luar sertao cidade mulher dancar cantar viver amar " +
    "assim ainda hoje noite dia cabeca coisa coisas gente ja nunca mais demais lembrar esquecer aceito"
  ).split(/\s+/),
);
/** Words that only count when they appear with other Portuguese words (shared with Spanish or Italian). */
const WEAK = new Set("hoje noite dia nunca mais demais assim ainda agora sempre longe amar viver cantar cidade mulher olhos boca".split(" "));

const BR_TERMS = [
  "brasil", "brasileir", "samba", "pagode", "forro", "sertanej", "bossa nova", "mpb", "frevo", "baiao", "lambada",
  "maracatu", "seresta", "chorinho", "axe music", "musica popular brasileira", "sao paulo",
];

const BR_ARTISTS = [
  "roberto carlos", "erasmo carlos", "legiao urbana", "renato russo", "tim maia", "caetano veloso", "gilberto gil",
  "djavan", "chico buarque", "tom jobim", "antonio carlos jobim", "jorge ben", "raul seixas", "titas", "paralamas",
  "skank", "kid abelha", "barao vermelho", "cazuza", "lulu santos", "marisa monte", "ivete sangalo", "zeze di camargo",
  "leandro e leonardo", "leandro & leonardo", "chitaozinho", "xororo", "bruno e marrone", "fabio jr", "ze ramalho",
  "alceu valenca", "luiz gonzaga", "elis regina", "gal costa", "maria bethania", "milton nascimento",
  "ney matogrosso", "rita lee", "mutantes", "engenheiros do hawaii", "capital inicial", "ultraje a rigor",
  "mamonas", "charlie brown jr", "jota quest", "cidade negra", "biquini cavadao", "ed motta", "vinicius de moraes",
  "joao gilberto", "sandy e junior", "sandy & junior", "xuxa", "fagner", "belchior", "roupa nova", "14 bis",
  "guilherme arantes", "wanderlea", "nelson goncalves", "pixinguinha", "noel rosa", "cartola", "zeca pagodinho",
  "martinho da vila", "beth carvalho", "alcione", "so pra contrariar", "raca negra", "exaltasamba", "molejo",
  "daniela mercury", "chiclete com banana", "banda eva", "e o tchan", "asa de aguia", "amado batista",
  "reginaldo rossi", "odair jose", "sidney magal", "fafa de belem", "ivan lins", "joao bosco", "toquinho",
  "adriana calcanhotto", "zelia duncan", "cassia eller", "nando reis", "arnaldo antunes", "pato fu", "raimundos",
  "o rappa", "chico science", "lenine", "seu jorge", "ana carolina", "vanessa da mata", "maria rita",
  "marcelo rossi", "aline barros", "fernanda brum", "oficina g3", "rosa de saron", "kleiton", "kledir",
  "joao paulo e daniel", "chrystian e ralf", "gian e giovani", "rick e renner", "edson e hudson", "leonardo",
  "netinho", "elba ramalho", "dominguinhos", "geraldo azevedo", "oswaldo montenegro", "beto guedes",
  "flavio venturini", "lo borges", "joao bosco", "paulinho da viola", "clara nunes", "jair rodrigues",
  "jorge aragao", "fundo de quintal", "katinguele", "negritude junior",
  "wando", "agepe", "benito di paula", "evaldo braga", "jerry adriani", "ronnie von", "renato e seus blue caps",
  "secos e molhados", "novos baianos", "moraes moreira", "baby consuelo",
  "pepeu gomes", "marina lima", "leo jaime", "kiko zambianchi",
  "hanoi hanoi", "plebe rude", "inimigos do rei", "lobao", "frejat",
  "angela ro ro", "sullivan e massadas", "tete espindola",
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function readVar(d: Uint8Array, i: number): [number, number] {
  let v = 0;
  for (let k = 0; k < 4; k++) {
    const b = d[i++]!;
    v = (v << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
  }
  return [v, i];
}

/** Text from meta events 1–7: free text, copyright, track names, instruments, lyrics, markers, cues. */
function midiText(d: Uint8Array): string {
  const parts: string[] = [];
  let lyric = "";
  let p = 0;
  while (p + 8 <= d.length) {
    const id = String.fromCharCode(d[p]!, d[p + 1]!, d[p + 2]!, d[p + 3]!);
    const len = ((d[p + 4]! << 24) | (d[p + 5]! << 16) | (d[p + 6]! << 8) | d[p + 7]!) >>> 0;
    const start = p + 8;
    const end = Math.min(d.length, start + len);
    p = start + len;
    if (id !== "MTrk") continue;
    let i = start;
    let status = 0;
    while (i < end) {
      [, i] = readVar(d, i);
      let s = d[i]!;
      if (s & 0x80) i++;
      else s = status;
      if (s === 0xff) {
        const type = d[i++]!;
        let n: number;
        [n, i] = readVar(d, i);
        if (type >= 1 && type <= 7) {
          const txt = Buffer.from(d.subarray(i, i + n)).toString("latin1");
          if (type === 5) lyric += txt;
          else parts.push(txt);
        }
        i += n;
      } else if (s === 0xf0 || s === 0xf7) {
        let n: number;
        [n, i] = readVar(d, i);
        i += n;
      } else {
        status = s;
        const hi = s & 0xf0;
        i += hi === 0xc0 || hi === 0xd0 ? 1 : 2;
      }
    }
  }
  return `${parts.join(" \n ")} \n ${lyric.replace(/[-/\\]/g, "")}`;
}

interface Verdict {
  nacional: boolean;
  reason: string;
}

function judge(name: string, text: string): Verdict {
  const raw = `${name} \n ${text}`;
  const t = norm(raw);
  for (const a of BR_ARTISTS) {
    const re = new RegExp(`(^|[^a-z])${a.replace(/[.!&]/g, "\\$&")}([^a-z]|$)`);
    if (a.length >= 4 && re.test(t)) return { nacional: true, reason: `artist: ${a}` };
  }
  for (const b of BR_TERMS) {
    if (new RegExp(`(^|[^a-z])${b}`).test(t)) return { nacional: true, reason: `term: ${b}` };
  }
  const tilde = (raw.match(/[ãõÃÕ]/g) ?? []).length;
  const words = t.split(/[^a-z]+/).filter(Boolean);
  const strong = new Set<string>();
  const weak = new Set<string>();
  for (const w of words) {
    if (!PT_WORDS.has(w)) continue;
    (WEAK.has(w) ? weak : strong).add(w);
  }
  if (strong.size >= 3 || (strong.size >= 2 && weak.size >= 2) || (tilde >= 2 && strong.size >= 1)) {
    return { nacional: true, reason: `pt: ${[...strong].slice(0, 5).join(",")}${tilde ? ` ~${tilde}` : ""}` };
  }
  const stem = norm(basename(name, extname(name))).split(/[^a-z]+/).filter((w) => w.length >= 5);
  const hit = stem.find((w) => PT_WORDS.has(w) && !WEAK.has(w));
  if (hit) return { nacional: true, reason: `file: ${hit}` };
  return { nacional: false, reason: "" };
}

const categories = (await readdir(root, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && e.name !== NAT && e.name !== INT)
  .map((e) => e.name);

const rows: string[] = ["arquivo;ritmo;origem;motivo"];
const counts = new Map<string, [number, number]>();
const samples: string[] = [];
let total = 0;
for (const cat of categories) {
  const dir = join(root, cat);
  const files = (await readdir(dir)).filter((f) => /\.midi?$/i.test(f));
  for (const f of files) {
    let v: Verdict;
    try {
      v = judge(f, midiText(new Uint8Array(await readFile(join(dir, f)))));
    } catch {
      v = judge(f, "");
    }
    const c = counts.get(cat) ?? [0, 0];
    c[v.nacional ? 0 : 1]++;
    counts.set(cat, c);
    rows.push([f, cat, v.nacional ? NAT : INT, v.reason].join(";"));
    if (v.nacional && samples.length < 400) samples.push(`${f}  <- ${v.reason}`);
    if (MOVE) {
      const target = join(root, v.nacional ? NAT : INT, cat);
      await mkdir(target, { recursive: true });
      await rename(join(dir, f), join(target, f));
    }
    if (++total % 5000 === 0) console.log(`${total}`);
  }
  if (MOVE) await rmdir(dir).catch(() => undefined);
}

await writeFile(join(root, "nacional.csv"), "\uFEFF" + rows.join("\r\n"), "utf8");
if (!MOVE) console.log(samples.sort(() => Math.random() - 0.5).slice(0, 120).join("\n"));
let nat = 0;
for (const [cat, [n, i]] of [...counts].sort()) {
  nat += n;
  console.log(`${String(n).padStart(6)} nac ${String(i).padStart(6)} int  ${cat}`);
}
console.log(`${total} files, ${nat} nacional${MOVE ? " (moved)" : " (dry run)"}`);
