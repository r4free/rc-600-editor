import { ElectricPreviewEngine, type ElectricPreviewConfig } from "../audio/electricPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function ElectricPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<ElectricPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new ElectricPreviewEngine(cfg)}
      label="Sung melody"
      icon="mic"
      info={{
        label: "Electric preview",
        text: "A melody sung slightly off pitch, with scoops and vibrato, run through this Electric effect. Scale snaps it to every semitone (CHROMATIC) or to the notes of a key, Speed sets how fast it jumps to each note (high = robotic steps), Stability how far the voice must drift before the note changes, Shift transposes it, and Formant changes the voice character. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
