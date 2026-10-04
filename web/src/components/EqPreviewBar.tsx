import { EqPreviewEngine, type EqPreviewConfig } from "../audio/eqPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function EqPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<EqPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new EqPreviewEngine(cfg)}
      label="Band loop"
      icon="equalizer"
      info={{
        label: "EQ preview",
        text: "A full-range loop (kick, snare, hi-hats, bass and a bright pad) played through this equalizer with the settings below, so every band has something to boost or cut. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact EQ.",
      }}
    />
  );
}
