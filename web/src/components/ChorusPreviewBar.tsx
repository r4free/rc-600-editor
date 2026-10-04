import { ChorusPreviewEngine, type ChorusPreviewConfig } from "../audio/chorusPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function ChorusPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<ChorusPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new ChorusPreviewEngine(cfg)}
      label="Guitar chords"
      icon="strings"
      info={{
        label: "Chorus preview",
        text: "Strummed guitar chords (G – Em – C – D) played through this chorus with the settings below. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact chorus.",
      }}
    />
  );
}
