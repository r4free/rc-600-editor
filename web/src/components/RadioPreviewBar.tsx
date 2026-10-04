import { RadioPreviewEngine, type RadioPreviewConfig } from "../audio/radioPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function RadioPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<RadioPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new RadioPreviewEngine(cfg)}
      label="Voice and drums"
      icon="mic"
      info={{
        label: "Radio preview",
        text: "A sung melody and light drums played through this Radio effect. Lo-Fi narrows the band, adds grit and hiss (higher = more blurred), and Level sets the volume of the effect sound. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
