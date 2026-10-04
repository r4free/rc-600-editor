import { BeatFxPreviewEngine, type BeatFxEffect, type BeatFxPreviewConfig } from "../audio/beatFxPreview";
import { FxPreviewBar } from "./FxPreviewBar";

const EFFECT_TEXT: Record<BeatFxEffect, string> = {
  scatter: "the track is scrubbed in slices of the Length, in the order of the selected pattern (P1–P4)",
  repeat: "a slice of the Length is repeated forward, in reverse, or alternating (Mix)",
  shift: "playback jumps ahead (Future) or behind (Past) by the Shift amount",
  flick: "each beat slows down or speeds up as if you touched the turntable, then springs back",
};

export function BeatFxPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<BeatFxPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new BeatFxPreviewEngine(cfg)}
      label="Track loop"
      icon="loop"
      effectSwitch
      info={{
        label: "Beat FX preview",
        text: `A four-bar drum, bass, and melody track stands in for your loop. Like on the pedal, the effect only acts while the FX is on: press Effect to switch it on or off (it kicks in on the next beat), or Auto to hear the track once clean and then again with the effect on bars 3–4. The indicator shows what is playing. With the effect on, ${EFFECT_TEXT[props.settings.effect]}. With THRU the track plays unchanged. The pattern shapes and speeds are browser approximations, not the RC-600's exact sound.`,
      }}
    />
  );
}
