import { RollPreviewEngine, type RollPreviewConfig } from "../audio/rollPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function RollPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<RollPreviewConfig, "bpm">;
}) {
  const repeat = props.settings.infiniteAtMax ? "Repeat" : "Feedback";
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new RollPreviewEngine(cfg)}
      label="Beat and melody"
      icon="loop"
      info={{
        label: "Roll preview",
        text: `A beat and melody loop. Every other bar the effect is switched on: the start of the bar is captured and looped. Time sets the loop cycle and Roll splits it into shorter slices for a stutter. With Roll OFF, ${repeat} sets how many times the loop repeats before it fades. Balance blends the direct sound with the roll. This is a browser approximation, not the RC-600's exact sound.`,
      }}
    />
  );
}
