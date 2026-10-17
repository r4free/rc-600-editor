/**
 * setInterval / setTimeout that keep their pace when the tab is in the background or another app has focus:
 * the page's own timers drop to once a second (once a minute after ~5 min hidden), a dedicated worker's do not.
 * Without Worker support (tests, old browsers) they fall back to the page's timers.
 */
type Tick = () => void;

const SOURCE =
  'const t=new Map();onmessage=(e)=>{const d=e.data;if(d.op==="every")t.set(d.id,setInterval(()=>postMessage(d.id),d.ms));else if(d.op==="once")t.set(d.id,setTimeout(()=>{t.delete(d.id);postMessage(d.id);},d.ms));else{clearInterval(t.get(d.id));clearTimeout(t.get(d.id));t.delete(d.id);}};';

let worker: Worker | null | undefined;
let nextId = 1;
const ticks = new Map<number, { fn: Tick; once: boolean }>();
const fallback = new Map<number, { handle: ReturnType<typeof setInterval>; once: boolean }>();
type TimerFns = Pick<typeof globalThis, "setInterval" | "clearInterval" | "setTimeout" | "clearTimeout">;
const host = (): TimerFns => {
  const w = (typeof window !== "undefined" ? window : {}) as Partial<TimerFns>;
  return {
    setInterval: w.setInterval ?? globalThis.setInterval,
    clearInterval: w.clearInterval ?? globalThis.clearInterval,
    setTimeout: w.setTimeout ?? globalThis.setTimeout,
    clearTimeout: w.clearTimeout ?? globalThis.clearTimeout,
  } as TimerFns;
};

function clock(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return worker;
  try {
    const w = new Worker(URL.createObjectURL(new Blob([SOURCE], { type: "text/javascript" })));
    w.onmessage = (e: MessageEvent<number>) => {
      const t = ticks.get(e.data);
      if (!t) return;
      if (t.once) ticks.delete(e.data);
      t.fn();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

function start(fn: Tick, ms: number, once: boolean): number {
  const id = nextId++;
  const w = clock();
  if (w) {
    ticks.set(id, { fn, once });
    w.postMessage({ op: once ? "once" : "every", id, ms });
  } else if (once) {
    fallback.set(id, {
      once,
      handle: host().setTimeout(() => {
        fallback.delete(id);
        fn();
      }, ms),
    });
  } else {
    fallback.set(id, { once, handle: host().setInterval(fn, ms) });
  }
  return id;
}

function stop(id: number | null | undefined): void {
  if (id == null) return;
  if (ticks.delete(id)) clock()?.postMessage({ op: "clear", id });
  const f = fallback.get(id);
  if (f) {
    if (f.once) host().clearTimeout(f.handle);
    else host().clearInterval(f.handle);
    fallback.delete(id);
  }
}

export const setBgInterval = (fn: Tick, ms: number): number => start(fn, ms, false);
export const setBgTimeout = (fn: Tick, ms: number): number => start(fn, ms, true);
export const clearBgInterval = stop;
export const clearBgTimeout = stop;
