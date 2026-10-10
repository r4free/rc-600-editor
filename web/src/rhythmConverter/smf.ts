/** Note timing shared by converter parts (Standard MIDI File ticks). */

export const SMF_PPQ = 480;

export interface SmfNote {
  tick: number;
  note: number;
  velocity: number;
  duration: number;
}
