import { G2bPreviewEngine, type G2bPreviewConfig } from "../audio/g2bPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function G2bPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<G2bPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new G2bPreviewEngine(cfg)}
      label="Guitar riff"
      icon="guitar"
      info={{
        label: "G2B preview",
        text: "A guitar riff with the same line one octave lower as a bass. Balance blends the guitar (Direct) with the bass. Mode 2 gives a rounder bass that follows tightly; Mode 1 a buzzier, slightly late synth bass, to hint at the older algorithm. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
