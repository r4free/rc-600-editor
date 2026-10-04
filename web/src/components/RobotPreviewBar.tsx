import { RobotPreviewEngine, type RobotPreviewConfig } from "../audio/robotPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function RobotPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<RobotPreviewConfig, "bpm">;
}) {
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new RobotPreviewEngine(cfg)}
      label="Robot voice"
      icon="mic"
      info={{
        label: "Robot preview",
        text: "A sung phrase turned into a robot voice: the syllables keep their rhythm, but every one is sung on the fixed Note. Formant moves the voice toward masculine (−) or feminine (+), and Mode switches between the buzzier classic algorithm (1) and the smoother new one (2). Changes are heard on the next syllable. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
