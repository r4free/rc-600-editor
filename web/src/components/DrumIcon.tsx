import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** MDI has no drum-kit glyphs, so kick, snare, tom, hi-hat, cymbal, tambourine, hand drum and wood are drawn here in its outline style. */
type DrawnFamily = "kick" | "snare" | "tom" | "hihat" | "cymbal" | "tambourine" | "handDrum" | "wood";
type DrumFamily = DrawnFamily | "clap" | "shaker" | "triangle" | "bell" | "whistle";

const DRAWN: Record<DrawnFamily, ReactNode> = {
  kick: (
    <>
      <circle cx="12" cy="11" r="8" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M7 18l-2 3M17 18l2 3" />
    </>
  ),
  snare: (
    <>
      <ellipse cx="12" cy="11" rx="8" ry="2.5" />
      <path d="M4 11v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5" />
      <path d="M6 3l5 6M18 3l-5 6" />
    </>
  ),
  tom: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
    </>
  ),
  hihat: (
    <>
      <path d="M3 7.5c3-1.8 15-1.8 18 0M3 10.5c3 1.8 15 1.8 18 0" />
      <path d="M12 5v16M8 21h8" />
    </>
  ),
  cymbal: (
    <>
      <path d="M2.5 9c3-2.6 16-2.6 19 0c-3 1.4-16 1.4-19 0z" />
      <path d="M12 6v15M8 21l4-4l4 4" />
    </>
  ),
  tambourine: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="4.5" r="1.5" />
      <circle cx="19.5" cy="12" r="1.5" />
      <circle cx="12" cy="19.5" r="1.5" />
      <circle cx="4.5" cy="12" r="1.5" />
    </>
  ),
  handDrum: (
    <>
      <ellipse cx="12" cy="5" rx="5" ry="1.8" />
      <path d="M7 5l2 15h6l2-15" />
    </>
  ),
  wood: <path d="M4 7l16 10M4 17l16-10" />,
};

const MDI: Record<Exclude<DrumFamily, DrawnFamily>, IconName> = {
  clap: "clap",
  shaker: "shaker",
  triangle: "triangle",
  bell: "bell",
  whistle: "whistle",
};

const NOTE_FAMILY: Record<number, DrumFamily> = {
  35: "kick",
  36: "kick",
  37: "wood",
  38: "snare",
  39: "clap",
  40: "snare",
  41: "tom",
  42: "hihat",
  43: "tom",
  44: "hihat",
  45: "tom",
  46: "hihat",
  47: "tom",
  48: "tom",
  49: "cymbal",
  50: "tom",
  51: "cymbal",
  52: "cymbal",
  53: "cymbal",
  54: "tambourine",
  55: "cymbal",
  56: "bell",
  57: "cymbal",
  58: "shaker",
  59: "cymbal",
  60: "handDrum",
  61: "handDrum",
  62: "handDrum",
  63: "handDrum",
  64: "handDrum",
  65: "handDrum",
  66: "handDrum",
  67: "bell",
  68: "bell",
  69: "shaker",
  70: "shaker",
  71: "whistle",
  72: "whistle",
  73: "shaker",
  74: "shaker",
  75: "wood",
  76: "wood",
  77: "wood",
  78: "handDrum",
  79: "handDrum",
  80: "triangle",
  81: "triangle",
};

/** Small icon for a rhythm-kit note (kick, snare, cymbal…); nothing for notes outside the kit. */
export function DrumIcon({ note, size = 14 }: { note: number; size?: number }) {
  const family = NOTE_FAMILY[note];
  if (!family) return null;
  if (family in MDI) return <Icon name={MDI[family as keyof typeof MDI]} size={size} className="drum-icon" />;
  return (
    <svg
      className="ui-icon drum-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DRAWN[family as DrawnFamily]}
    </svg>
  );
}
