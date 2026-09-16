import { addCollection, Icon as IconifyIcon } from "@iconify/react/offline";
import type { IconifyJSON } from "@iconify/types";
import collection from "../iconify-mdi.json";

/** Bundled MDI subset (offline). To add an icon, copy it from `@iconify-json/mdi` into `iconify-mdi.json`. */
addCollection(collection as IconifyJSON);

const ICONS = {
  play: "mdi:play",
  playCircle: "mdi:play-circle-outline",
  stop: "mdi:stop",
  save: "mdi:content-save-outline",
  refresh: "mdi:refresh",
  usb: "mdi:usb",
  connect: "mdi:link-variant",
  disconnect: "mdi:link-variant-off",
  midiHelp: "mdi:midi-port",
  midi: "mdi:midi",
  piano: "mdi:piano",
  controls: "mdi:gamepad-variant-outline",
  expansion: "mdi:puzzle-outline",
  board: "mdi:view-dashboard-outline",
  library: "mdi:bookshelf",
  system: "mdi:cog-outline",
  external: "mdi:open-in-new",
  tune: "mdi:tune-variant",
  mfx: "mdi:waveform",
  strings: "mdi:guitar-acoustic",
  others: "mdi:dots-horizontal",
  master: "mdi:volume-high",
  chorus: "mdi:waves",
  reverb: "mdi:blur",
  close: "mdi:close",
  back: "mdi:arrow-left",
  search: "mdi:magnify",
  notesOff: "mdi:music-off",
  blocks: "mdi:view-grid-outline",
  chain: "mdi:vector-polyline",
  copy: "mdi:content-copy",
  paste: "mdi:content-paste",
  scene: "mdi:playlist-music",
  tempo: "mdi:metronome",
  help: "mdi:help-circle-outline",
  alert: "mdi:alert-outline",
  keyboard: "mdi:keyboard",
  live: "mdi:circle",
  dirty: "mdi:circle-medium",
  guitar: "mdi:guitar-electric",
  info: "mdi:information-outline",
  loop: "mdi:repeat",
  record: "mdi:record-circle",
  folderOpen: "mdi:folder-open-outline",
  eject: "mdi:eject",
  archive: "mdi:folder-zip-outline",
  restore: "mdi:restore",
  note: "mdi:music-note",
  mic: "mdi:microphone-outline",
  equalizer: "mdi:equalizer",
  chevronDown: "mdi:chevron-down",
  chevronRight: "mdi:chevron-right",
  download: "mdi:download",
  upload: "mdi:upload",
  deleteOutline: "mdi:delete-outline",
  pause: "mdi:pause",
  fullscreen: "mdi:fullscreen",
  fullscreenExit: "mdi:fullscreen-exit",
  heart: "mdi:heart",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className,
  size = "1em",
}: {
  name: IconName;
  className?: string;
  size?: number | string;
}) {
  return (
    <IconifyIcon
      icon={ICONS[name]}
      width={size}
      height={size}
      className={className ? `ui-icon ${className}` : "ui-icon"}
      aria-hidden="true"
      focusable="false"
    />
  );
}
