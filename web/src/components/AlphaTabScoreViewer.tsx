import { useCallback, useEffect, useRef, useState } from "react";
import type { SetlistScoreGuide, SetlistSong } from "../presets/playlist";
import { midiNoteName, scoreVoiceStateFromActiveBeats } from "../setlists/alphaTabVoice";
import { scoreAssetStore } from "../setlists/scoreAssetStore";
import { Icon } from "./Icon";

interface ScoreTrackInfo {
  index: number;
  name: string;
}

export interface AlphaTabVoiceTarget {
  midi: number;
  name: string;
}

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function applyTrackAudio(api: any, guide: SetlistScoreGuide): void {
  if (!api?.score?.tracks) return;
  const muted = new Set(guide.mutedTrackIndexes ?? []);
  for (const track of api.score.tracks) {
    api.changeTrackMute([track], muted.has(track.index));
  }
}

export function AlphaTabScoreViewer({
  setlistName,
  song,
  index,
  count,
  onBack,
  onPrevious,
  onNext,
  onGuideChange,
  onCurrentChord,
  onVoiceTarget,
  children,
}: {
  setlistName: string;
  song: SetlistSong & { music: SetlistScoreGuide };
  index: number;
  count: number;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onGuideChange: (guide: SetlistScoreGuide) => void;
  onCurrentChord: (chord: string | null) => void;
  onVoiceTarget: (target: AlphaTabVoiceTarget | null) => void;
  children?: React.ReactNode;
}) {
  const guide = song.music;
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const guideRef = useRef(guide);
  const lastChordRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onGuideChange, onCurrentChord, onVoiceTarget });
  callbacksRef.current = { onGuideChange, onCurrentChord, onVoiceTarget };
  const [tracks, setTracks] = useState<ScoreTrackInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    guideRef.current = guide;
    const api = apiRef.current;
    if (!api) return;
    api.masterVolume = guide.scoreAudio ? 1 : 0;
    api.metronomeVolume = guide.metronome ? 1 : 0;
    api.countInVolume = guide.countIn ? 1 : 0;
    api.playbackSpeed = guide.playbackSpeed;
    applyTrackAudio(api, guide);
  }, [guide]);

  const emitActiveBeat = useCallback((args: any) => {
    const activeBeats: any[] = Array.isArray(args?.activeBeats) ? args.activeBeats : [];
    const { chord, targetMidi } = scoreVoiceStateFromActiveBeats(
      activeBeats,
      guideRef.current.vocalTrackIndex,
    );
    if (chord) lastChordRef.current = chord;
    callbacksRef.current.onCurrentChord(lastChordRef.current);
    callbacksRef.current.onVoiceTarget(
      targetMidi === null ? null : { midi: targetMidi, name: midiNoteName(targetMidi) },
    );
  }, []);

  useEffect(() => {
    if (!hostRef.current || !scrollRef.current) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    setTracks([]);
    setPosition(0);
    setDuration(0);
    lastChordRef.current = null;

    void (async () => {
      const asset = await scoreAssetStore.get(guide.assetId);
      if (!asset) throw new Error("The score file is missing. Import it again.");
      const alphaTab = await import("@coderline/alphatab");
      if (cancelled || !hostRef.current || !scrollRef.current) return;
      const api = new alphaTab.AlphaTabApi(hostRef.current, {
        core: { fontDirectory: "/font/" },
        player: {
          enablePlayer: true,
          enableCursor: true,
          enableUserInteraction: true,
          soundFont: "/soundfont/sonivox.sf3",
          scrollElement: scrollRef.current,
        },
        display: {
          staveProfile: alphaTab.StaveProfile.ScoreTab,
        },
      });
      apiRef.current = api;
      api.scoreLoaded.on((score: any) => {
        if (cancelled) return;
        const nextTracks = (score?.tracks ?? []).map((track: any, trackIndex: number) => ({
          index: Number.isInteger(track?.index) ? track.index : trackIndex,
          name: String(track?.name || `Track ${trackIndex + 1}`),
        }));
        setTracks(nextTracks);
        if (!guideRef.current.selectedTrackIndexes.length && nextTracks.length) {
          callbacksRef.current.onGuideChange({
            ...guideRef.current,
            selectedTrackIndexes: [nextTracks[0]!.index],
          });
        }
      });
      api.playerReady.on(() => {
        if (cancelled) return;
        setReady(true);
        api.masterVolume = guideRef.current.scoreAudio ? 1 : 0;
        api.metronomeVolume = guideRef.current.metronome ? 1 : 0;
        api.countInVolume = guideRef.current.countIn ? 1 : 0;
        api.playbackSpeed = guideRef.current.playbackSpeed;
        applyTrackAudio(api, guideRef.current);
      });
      api.playerStateChanged.on((args: any) => {
        if (!cancelled) setPlaying(Boolean(args?.state === 1 || args?.state === "playing"));
      });
      api.playerPositionChanged.on((args: any) => {
        if (cancelled) return;
        setPosition(Number(args?.currentTime) || 0);
        setDuration(Number(args?.endTime) || 0);
      });
      api.activeBeatsChanged.on(emitActiveBeat);
      api.error.on((event: any) => {
        if (!cancelled) setError(String(event?.message || "Could not load the score"));
      });
      const selected = guideRef.current.selectedTrackIndexes;
      api.load(asset.bytes, selected.length ? selected : undefined);
    })().catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the score");
    });

    return () => {
      cancelled = true;
      callbacksRef.current.onCurrentChord(null);
      callbacksRef.current.onVoiceTarget(null);
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, [emitActiveBeat, guide.assetId]);

  const renderSelectedTracks = (selectedTrackIndexes: number[]) => {
    const api = apiRef.current;
    if (api?.score) {
      const selectedTracks = api.score.tracks.filter((track: any) =>
        selectedTrackIndexes.includes(track.index),
      );
      if (selectedTracks.length) api.renderTracks(selectedTracks);
    }
    onGuideChange({ ...guide, selectedTrackIndexes });
  };

  return (
    <section className="setlist-chart-stage alphatab-stage" aria-label={`${song.name} score`}>
      <header className="setlist-chart-stage-head">
        <button type="button" className="btn ghost" onClick={onBack}>
          <Icon name="back" /> Songs
        </button>
        <div>
          <span className="playlist-eyebrow">{setlistName} · {index + 1}/{count}</span>
          <h2>{song.name}</h2>
        </div>
        <div className="setlist-chart-meta">
          <strong>{guide.fileName}</strong>
          <span>Guitar Pro / MusicXML</span>
        </div>
      </header>

      <div className="alphatab-toolbar">
        <button type="button" className="btn primary" disabled={!ready} onClick={() => apiRef.current?.playPause()}>
          <Icon name={playing ? "pause" : "play"} /> {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="btn ghost" disabled={!ready} onClick={() => apiRef.current?.stop()}>
          <Icon name="stop" /> Restart
        </button>
        <span>{formatTime(position)} / {formatTime(duration)}</span>
        <input
          aria-label="Score position"
          type="range"
          min={0}
          max={Math.max(1, duration)}
          value={Math.min(position, duration || 0)}
          onChange={(event) => {
            if (apiRef.current) apiRef.current.timePosition = Number(event.target.value);
          }}
        />
        <Toggle label="Metronome" checked={guide.metronome} onChange={(metronome) => onGuideChange({ ...guide, metronome })} />
        <Toggle label="Score audio" checked={guide.scoreAudio} onChange={(scoreAudio) => onGuideChange({ ...guide, scoreAudio })} />
      </div>

      {tracks.length ? (
        <div className="alphatab-track-controls">
          <details>
            <summary>Visible tracks</summary>
            {tracks.map((track) => (
              <label key={track.index}>
                <input
                  type="checkbox"
                  checked={guide.selectedTrackIndexes.includes(track.index)}
                  onChange={(event) => {
                    const selected = event.target.checked
                      ? [...guide.selectedTrackIndexes, track.index]
                      : guide.selectedTrackIndexes.filter((index) => index !== track.index);
                    if (selected.length) renderSelectedTracks(selected);
                  }}
                />
                {track.name}
              </label>
            ))}
          </details>
          <details>
            <summary>Audio tracks</summary>
            {tracks.map((track) => {
              const audible = !(guide.mutedTrackIndexes ?? []).includes(track.index);
              return (
                <label key={track.index}>
                  <input
                    type="checkbox"
                    checked={audible}
                    onChange={(event) => {
                      const mutedTrackIndexes = event.target.checked
                        ? (guide.mutedTrackIndexes ?? []).filter((index) => index !== track.index)
                        : [...(guide.mutedTrackIndexes ?? []), track.index];
                      const scoreTrack = apiRef.current?.score?.tracks?.find(
                        (candidate: any) => candidate.index === track.index,
                      );
                      if (scoreTrack) {
                        apiRef.current.changeTrackMute([scoreTrack], !event.target.checked);
                      }
                      onGuideChange({ ...guide, mutedTrackIndexes });
                    }}
                  />
                  {track.name}
                </label>
              );
            })}
          </details>
          <label className="playlist-field">
            <span>Vocal melody track</span>
            <select
              value={guide.vocalTrackIndex ?? ""}
              onChange={(event) =>
                onGuideChange({
                  ...guide,
                  vocalTrackIndex: event.target.value ? Number(event.target.value) : undefined,
                })
              }
            >
              <option value="">No vocal melody</option>
              {tracks.map((track) => <option key={track.index} value={track.index}>{track.name}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {error ? <p className="voice-tone-warning" role="alert">{error}</p> : null}
      {!ready && !error ? <p className="playlist-status">Loading score…</p> : null}
      <div className="alphatab-scroll" ref={scrollRef}>
        <div className="alphatab-host" ref={hostRef} />
      </div>

      {children}

      <footer className="setlist-chart-stage-foot">
        <button type="button" className="btn ghost" onClick={onPrevious}>Previous</button>
        <button type="button" className="btn primary" onClick={onNext}>Next</button>
      </footer>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={`btn ghost${checked ? " is-active" : ""}`}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      {label} {checked ? "ON" : "OFF"}
    </button>
  );
}
