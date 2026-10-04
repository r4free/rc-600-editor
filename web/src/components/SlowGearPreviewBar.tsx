import { SlowGearPreviewEngine, type SlowGearPreviewConfig } from "../audio/slowGearPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function SlowGearPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<SlowGearPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new SlowGearPreviewEngine(cfg)}
      label="Guitar notes"
      icon="guitar"
      info={{
        label: "Slow Gear preview",
        text: "Guitar notes once a bar, picked hard, soft, medium and very soft in turn. Each pick strong enough for Sens fades in over the Rise Time; softer picks stay almost silent, so raising Sens makes more of the notes swell. Level sets the volume, and Mode 1 swells in a straight line while Mode 2 swells with a smoother curve. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
