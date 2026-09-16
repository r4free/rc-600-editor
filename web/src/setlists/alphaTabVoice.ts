export interface AlphaTabBeatLike {
  chord?: { name?: unknown } | null;
  notes?: Array<{ realValue?: unknown }> | null;
  voice?: { bar?: { staff?: { track?: { index?: unknown } } } };
}

export interface ScoreVoiceState {
  chord: string | null;
  targetMidi: number | null;
}

export function scoreVoiceStateFromActiveBeats(
  activeBeats: readonly AlphaTabBeatLike[],
  vocalTrackIndex?: number,
): ScoreVoiceState {
  let chord: string | null = null;
  let targetMidi: number | null = null;
  for (const beat of activeBeats) {
    if (!chord && typeof beat.chord?.name === "string" && beat.chord.name.trim()) {
      chord = beat.chord.name.trim();
    }
    const trackIndex = Number(beat.voice?.bar?.staff?.track?.index);
    if (trackIndex !== vocalTrackIndex) continue;
    const pitches = (beat.notes ?? [])
      .map((note) => Number(note.realValue))
      .filter(Number.isFinite);
    if (pitches.length) targetMidi = Math.max(...pitches);
  }
  return { chord, targetMidi };
}

export function midiNoteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;
}
