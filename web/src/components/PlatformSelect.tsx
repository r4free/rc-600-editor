import { GM_EDITOR_URL, RC_EDITOR_URL, TONEX_EDITOR_URL, VG_EDITOR_URL } from "../api";

export type EditorPlatformId = "rc-600" | "vg-800" | "gm-800" | "tonex";

export const EDITOR_PLATFORMS: { id: EditorPlatformId; label: string; url: string }[] = [
  { id: "rc-600", label: "RC-600 Editor", url: RC_EDITOR_URL },
  { id: "vg-800", label: "VG-800 Editor", url: VG_EDITOR_URL },
  { id: "gm-800", label: "GM-800 Editor", url: GM_EDITOR_URL },
  { id: "tonex", label: "TONEX Pedal Editor", url: TONEX_EDITOR_URL },
];

export function PlatformSelect({ current }: { current: EditorPlatformId }) {
  return (
    <select
      className="product-switch"
      aria-label="Switch editor"
      value={current}
      onChange={(e) => {
        const next = EDITOR_PLATFORMS.find((p) => p.id === e.target.value);
        if (!next || next.id === current) return;
        window.location.assign(next.url);
      }}
    >
      {EDITOR_PLATFORMS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
