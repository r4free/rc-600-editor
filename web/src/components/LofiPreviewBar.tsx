import { LofiPreviewEngine, type LofiPreviewConfig } from "../audio/lofiPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function LofiPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<LofiPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new LofiPreviewEngine(cfg)}
      label="Keys and drums"
      icon="piano"
      info={{
        label: "Lo-Fi preview",
        text: "A keys and drums beat played through this Lo-Fi with the settings below. Bit Depth and Sample Rate crush the effect sound, and Balance blends it with the direct sound. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
