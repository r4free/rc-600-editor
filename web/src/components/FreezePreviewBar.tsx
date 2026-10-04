import { FreezePreviewEngine, type FreezePreviewConfig } from "../audio/freezePreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function FreezePreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<FreezePreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new FreezePreviewEngine(cfg)}
      label="Chord and melody"
      icon="piano"
      info={{
        label: "Freeze preview",
        text: "Every four bars a chord is struck and frozen for two bars while a melody keeps playing on top. The held chord fades in over Attack, settles to the Sustain level over Decay, and fades out over Release when the freeze is switched off. Balance blends the live sound and the frozen sound. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
