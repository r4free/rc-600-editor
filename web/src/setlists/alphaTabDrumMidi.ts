export interface ForwardedDrumNote {
  note: number;
  velocity: number;
  down: boolean;
}

export function alphaTabDrumNote(
  event: {
    type?: unknown;
    command?: unknown;
    channel?: unknown;
    noteKey?: unknown;
    noteVelocity?: unknown;
  },
  acceptedChannels: ReadonlySet<number>,
  noteOnType: number,
  noteOffType: number,
): ForwardedDrumNote | null {
  if (!acceptedChannels.has(Number(event.channel))) return null;
  const note = Number(event.noteKey);
  if (!Number.isFinite(note) || note < 0 || note > 127) return null;
  const hasType = Number.isFinite(Number(event.type));
  const command = Number(event.command) & 0xf0;
  const velocity = Math.max(1, Math.min(127, Number(event.noteVelocity) || 100));
  const isNoteOn = hasType
    ? Number(event.type) === noteOnType
    : command === 0x90 && Number(event.noteVelocity) > 0;
  const isNoteOff = hasType
    ? Number(event.type) === noteOffType
    : command === 0x80 || (command === 0x90 && Number(event.noteVelocity) === 0);
  if (isNoteOn) return { note, velocity, down: true };
  if (isNoteOff) return { note, velocity: 0, down: false };
  return null;
}
