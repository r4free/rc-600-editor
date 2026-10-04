import type { Setlist } from "./presets/playlist";

/** Public view-only page. Sample RC0 files, no pedal connection. */
export function isDemoPage(pathname?: string): boolean {
  const raw =
    pathname ?? (typeof location !== "undefined" ? location.pathname : "/");
  const path = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return path === "/demo";
}

/** Sample setlist shown on the demo page. It is not written to this browser. */
export function demoSetlist(): Setlist {
  return {
    id: "demo-saturday",
    name: "Saturday set",
    updatedAt: "2026-10-04T00:00:00.000Z",
    songs: [
      {
        id: "demo-opening",
        name: "Opening",
        memorySlot: 1,
        memoryName: "Memory 01",
        beforeChange: [],
        afterChange: [],
        music: {
          kind: "scroll",
          format: "chords",
          key: "G",
          mode: "major",
          transpose: 0,
          source: "G  D  Em  C\nG  D  C  D",
        },
      },
      {
        id: "demo-second",
        name: "Second song",
        memorySlot: 2,
        memoryName: "Memory 02",
        beforeChange: [],
        afterChange: [],
      },
    ],
  };
}
