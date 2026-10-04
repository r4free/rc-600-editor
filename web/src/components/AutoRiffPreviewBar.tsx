import { AutoRiffPreviewEngine, type AutoRiffPreviewConfig } from "../audio/autoRiffPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function AutoRiffPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<AutoRiffPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new AutoRiffPreviewEngine(cfg)}
      label="Guitar notes"
      icon="guitar"
      info={{
        label: "Auto Riff preview",
        text: "A guitar plays one note every two bars (I – vi – IV – V in the Key) and a synth riff follows the Phrase from that note, at the Tempo below. The guitar note lasts one bar: with Hold OFF the riff stops when it fades, with Hold ON it keeps going. Loop repeats the phrase; OFF plays it once. Attack and Balance are heard too, and the phrase picture lights up the step that is playing. Changes are heard while it plays. The RC-600's 30 phrases are not published, so each Phrase number plays its own riff here but the pedal's exact phrase may differ. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
