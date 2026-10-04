import { TwistPreviewEngine, type TwistPreviewConfig } from "../audio/twistPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function TwistPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<TwistPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new TwistPreviewEngine(cfg)}
      label="Beat and pad"
      icon="loop"
      info={{
        label: "Twist preview",
        text: "A beat and pad loop. Every four bars the effect is switched on for two bars, so you hear the rotation speed up over the Rise time, and then switched off: with Release FALL it stops at once, with FADE it fades out over the Fall time while still rotating. Level sets the effect volume. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
