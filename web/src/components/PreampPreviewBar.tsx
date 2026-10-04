import { PreampPreviewEngine, type PreampPreviewConfig } from "../audio/preampPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function PreampPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<PreampPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(config) => new PreampPreviewEngine(config)}
      label="Amp guitar"
      icon="strings"
      info={{
        label: "Preamp preview",
        text: "A synthesized guitar phrase played through an approximate amp, cabinet and microphone chain. Amp Type, Speaker Type, Gain, T-Comp, EQ, Mic Type, Distance, Position and Effect Level are heard live. This comparison preview is not the RC-600's exact preamp.",
      }}
    />
  );
}
