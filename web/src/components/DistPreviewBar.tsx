import { DistPreviewEngine, type DistPreviewConfig } from "../audio/distPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function DistPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<DistPreviewConfig, "bpm">;
}) {
  const vocal = props.settings.type === 0;
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new DistPreviewEngine(cfg)}
      label={vocal ? "Sung line" : "Guitar riff"}
      icon={vocal ? "mic" : "guitar"}
      info={{
        label: "Dist preview",
        text: "A power-chord guitar riff (a sung line for VOCAL) through the selected distortion type. Dist sets how hard it is driven, Tone makes it darker or brighter, and D.Level and E.Level blend the clean and distorted sound. Changes are heard while it plays. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
