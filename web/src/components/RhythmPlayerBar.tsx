import type { CSSProperties } from "react";
import type { PlaybackSegment } from "../rhythmConverter/previewPlayer";
import { PART_LABELS, PART_SHORT, type PartRole } from "../rhythmConverter/sectionSuggest";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";

export interface PlayerPrefs {
  /** Parts left out of rhythm playback (new parts play by default). */
  skip: PartRole[];
  repeats: number;
  loop: boolean;
  /** Null follows the rhythm's own tempo. */
  tempo: number | null;
}

export const DEFAULT_PLAYER_PREFS: PlayerPrefs = { skip: [], repeats: 2, loop: true, tempo: null };
export const PLAYER_TEMPO_MIN = 40;
export const PLAYER_TEMPO_MAX = 250;

const PLAYER_ORDER: PartRole[] = ["intro", "varA", "fillA", "varB", "fillB", "varC", "fillC", "varD", "fillD", "ending"];

const PLAYER_TEXT =
  "Plays the rhythm the way the pedal runs it: Intro, then each variation followed by its fill, then Ending. Click a part to leave it out or put it back; only parts that are set can play. Variation Repeats sets how many times each variation plays before its fill. Loop starts again after the last part. Tempo changes the preview speed only; the rhythm is saved with its own tempo. Edits you make while it plays are heard on the next pass, and the part being played is highlighted in the list and in the editor.";

export function RhythmPlayerBar({
  available,
  prefs,
  onPrefs,
  rhythmTempo,
  playing,
  now,
  progress,
  colors,
  onToggle,
}: {
  /** Parts that are set (anything with `has`, such as a Map by role). */
  available: { has(role: PartRole): boolean };
  prefs: PlayerPrefs;
  onPrefs: (prefs: PlayerPrefs) => void;
  rhythmTempo: number;
  playing: boolean;
  now: { segment: PlaybackSegment; within: number } | null;
  /** Position in the whole sequence, 0–1. */
  progress: number;
  colors: Record<PartRole, string>;
  onToggle: () => void;
}) {
  const picked = PLAYER_ORDER.filter((r) => available.has(r) && !prefs.skip.includes(r));
  const tempo = prefs.tempo ?? rhythmTempo;
  const toggleRole = (role: PartRole) =>
    onPrefs({
      ...prefs,
      skip: prefs.skip.includes(role) ? prefs.skip.filter((r) => r !== role) : [...prefs.skip, role],
    });

  return (
    <div className="rhythm-player" aria-label="Rhythm Player">
      <div className="rhythm-player-main">
        <button
          type="button"
          className={`btn${playing ? " is-on" : " primary"}`}
          onClick={onToggle}
          disabled={!playing && !picked.length}
        >
          <Icon name={playing ? "stop" : "play"} size={14} />
          {playing ? "Stop" : "Play Rhythm"}
        </button>
        <span className="rhythm-player-now">
          {playing && now
            ? `${PART_LABELS[now.segment.role]}${now.segment.passes > 1 ? ` · ${now.segment.pass}/${now.segment.passes}` : ""}`
            : picked.length
              ? `${picked.length} part${picked.length === 1 ? "" : "s"} ready`
              : "No parts to play"}
        </span>
        <InfoTip label="Rhythm Player" text={PLAYER_TEXT} />
        <span className="rhythm-editor-spacer" />
        <label className="drum-pad-field rhythm-player-field">
          <span>Variation Repeats</span>
          <span className="rhythm-player-slider">
            <input
              type="range"
              min={1}
              max={8}
              value={prefs.repeats}
              onChange={(e) => onPrefs({ ...prefs, repeats: Number(e.target.value) })}
            />
            <span className="param-val">{prefs.repeats}×</span>
          </span>
        </label>
        <label className="drum-pad-field rhythm-player-field">
          <span>Tempo</span>
          <span className="rhythm-player-slider">
            <input
              type="range"
              min={PLAYER_TEMPO_MIN}
              max={PLAYER_TEMPO_MAX}
              value={tempo}
              onChange={(e) => onPrefs({ ...prefs, tempo: Number(e.target.value) })}
            />
            <span className="param-val">{tempo} BPM</span>
          </span>
        </label>
        {prefs.tempo != null && prefs.tempo !== rhythmTempo ? (
          <button type="button" className="btn ghost" onClick={() => onPrefs({ ...prefs, tempo: null })} title={`Back to ${rhythmTempo} BPM`}>
            <Icon name="restore" size={14} />
          </button>
        ) : null}
        <label className="drum-pad-field rhythm-player-field">
          <span>Loop</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.loop}
            className={`power-switch${prefs.loop ? " on" : ""}`}
            onClick={() => onPrefs({ ...prefs, loop: !prefs.loop })}
          >
            <span className="power-switch-track">
              <span className="power-switch-thumb" />
            </span>
            <span className="power-switch-state">{prefs.loop ? "ON" : "OFF"}</span>
          </button>
        </label>
      </div>
      <div className="rhythm-player-parts" role="group" aria-label="Parts to play">
        {PLAYER_ORDER.map((role) => {
          const ready = available.has(role);
          const on = ready && !prefs.skip.includes(role);
          const sounding = playing && now?.segment.role === role;
          return (
            <button
              key={role}
              type="button"
              className={`rhythm-player-chip${on ? " is-on" : ""}${sounding ? " is-sounding" : ""}`}
              style={{ "--role-color": colors[role] } as CSSProperties}
              aria-pressed={on}
              disabled={!ready}
              title={ready ? `${on ? "Leave out" : "Play"} ${PART_LABELS[role]}` : `${PART_LABELS[role]} is not set`}
              onClick={() => toggleRole(role)}
            >
              {PART_SHORT[role]}
              {sounding ? <span className="rhythm-player-chip-fill" style={{ width: `${(now?.within ?? 0) * 100}%` }} /> : null}
            </button>
          );
        })}
      </div>
      {playing ? <span className="rhythm-conv-progress" style={{ width: `${progress * 100}%` }} /> : null}
    </div>
  );
}
