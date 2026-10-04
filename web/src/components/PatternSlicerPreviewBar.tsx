import { PatternSlicerPreviewEngine, type PatternSlicerPreviewConfig } from "../audio/patternSlicerPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function PatternSlicerPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<PatternSlicerPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new PatternSlicerPreviewEngine(cfg)}
      label="Synth pad"
      icon="mfx"
      info={{
        label: "Pattern Slicer preview",
        text: "A sustained synth pad (G – Em – C – D) cut into slices with the Rate, Duty, Attack, Pattern, Depth and Comp settings below. Changes are heard while it plays. Each Pattern number plays its own rhythm here, but the RC-600's 20 built-in rhythms are not published, so the pedal's exact pattern may differ. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
