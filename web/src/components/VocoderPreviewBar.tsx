import { VocoderPreviewEngine, type VocoderPreviewConfig } from "../audio/vocoderPreview";
import { FxPreviewBar } from "./FxPreviewBar";

export function VocoderPreviewBar(props: {
  slot: string;
  initialBpm: number;
  memoryBpm?: number | null;
  settings: Omit<VocoderPreviewConfig, "bpm">;
}) {
  const osc = Boolean(props.settings.osc);
  return (
    <FxPreviewBar
      {...props}
      createEngine={(cfg) => new VocoderPreviewEngine(cfg)}
      label={osc ? "Voice and MIDI notes" : "Voice and chords"}
      icon="mic"
      info={{
        label: osc ? "OSC Voc preview" : "Vocoder preview",
        text: osc
          ? "A spoken rhythm (the audio input) shapes the oscillator, which plays chords as if they were MIDI note messages sent to the RC-600, so the chords seem to talk. Carrier picks the waveform and Octave its pitch. Each chord is released just before the next one, so Release is heard as the tail. Tone, Attack, Mod Sens and Balance work as on the Vocoder. This is a browser approximation, not the RC-600's exact sound."
          : "A spoken rhythm (the audio input) shapes a chord pad that stands in for the Carrier track or input, so the chords seem to talk. Tone makes the vocoder darker or brighter, Attack sets how quickly it follows the voice, Mod Sens how strongly the voice drives it, and Balance blends your voice with the vocoder. A track carrier is always heard as a loop; an input carrier is heard on its own only with Carrier Thru on. This is a browser approximation, not the RC-600's exact sound.",
      }}
    />
  );
}
