import { DelayPreviewEngine, type DelayPreviewConfig } from "../audio/delayPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function DelayPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<DelayPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new DelayPreviewEngine(cfg)}
      label="Guitar phrase"
      icon="strings"
      info={{
        label: "Delay preview",
        text: "Two plucked guitar notes per bar, with space to hear the repeats, played through this delay with the settings below. Note-based Times follow the BPM. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact delay.",
      }}
    />
  );
}
