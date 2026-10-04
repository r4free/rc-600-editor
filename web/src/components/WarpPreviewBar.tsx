import { WarpPreviewEngine, type WarpPreviewConfig } from "../audio/warpPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function WarpPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<WarpPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new WarpPreviewEngine(cfg)}
      label="Pad and melody"
      icon="reverb"
      info={{
        label: "Warp preview",
        text: "A pad and melody. Every four bars the effect is switched on for two, so you can compare: the sound melts into a slowly wobbling, washed-out haze. Level sets the volume of the effect sound. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
