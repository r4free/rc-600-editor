import { ReverbPreviewEngine, type ReverbPreviewConfig } from "../audio/reverbPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function ReverbPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<ReverbPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new ReverbPreviewEngine(cfg)}
      label="Chords and snare"
      icon="reverb"
      info={{
        label: "Reverb preview",
        text: "Short guitar chord stabs on beats 1 and 3 and a snare on 2 and 4, with gaps so you can hear the reverb tail. Plays through this reverb with the settings below; changes are heard while it plays. This is a browser approximation, not the RC-600's exact reverb.",
      }}
    />
  );
}
