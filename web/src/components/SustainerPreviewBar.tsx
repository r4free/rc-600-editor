import { SustainerPreviewEngine, type SustainerPreviewConfig } from "../audio/sustainerPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function SustainerPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<SustainerPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new SustainerPreviewEngine(cfg)}
      label="Guitar notes"
      icon="guitar"
      info={{
        label: "Sustainer preview",
        text: "Single picked guitar notes, two beats apart, played through this Sustainer with the settings below, so you can hear how long each note rings. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
