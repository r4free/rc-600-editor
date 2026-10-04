import { HarmonyPreviewEngine, type HarmonyPreviewConfig } from "../audio/harmonyPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function HarmonyPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<HarmonyPreviewConfig, "bpm">;
}) {
  const auto = props.settings.kind === "auto";
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new HarmonyPreviewEngine(cfg)}
      label={auto ? "Melody and chords" : "Sung melody"}
      icon="mic"
      info={{
        label: "Harmony preview",
        text: auto
          ? "A sung melody over soft chords standing in for the MIDI chords the RC-600 would receive. The harmony voice follows the chords: HIGH and HIGHER pick the nearest chord notes above the melody, LOW and LOWER the ones below. Formant, Pan, Key, D.Level and Hrm Level are heard while it plays; Hrm Mode only changes which MIDI data the pedal uses, so it is not simulated. This is a browser approximation, not the RC-600's exact sound."
          : "A sung melody in the selected Key with a second voice added at the chosen interval of the scale. Formant changes the harmony's character, Pan places it left or right, and D.Level and Hrm Level balance the two voices. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
