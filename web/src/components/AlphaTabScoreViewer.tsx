import { useCallback, useEffect, useRef, useState } from "react";
import type { SetlistScoreGuide, SetlistSong } from "../presets/playlist";
import { alphaTabDrumNote } from "../setlists/alphaTabDrumMidi";
import { midiNoteName, scoreVoiceStateFromActiveBeats } from "../setlists/alphaTabVoice";
import { scoreAssetStore } from "../setlists/scoreAssetStore";
import { Icon } from "./Icon";

interface ScoreTrackInfo {
  index: number;
  name: string;
  isPercussion: boolean;
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
    const routedToRc600 =
      guide.rc600Drums === true && guide.drumTrackIndex === track.index;
    api.changeTrackMute([track], muted.has(track.index) || routedToRc600);
  }
}

export function AlphaTabScoreViewer({
  setlistName,
  song,
  index,
  count,
  keepPlaying = false,
  minimized = false,
  onKeepPlayingChange,
  onPlayingChange,
  onPlaybackEnded,
  playbackRef,
  onBack,
  onPrevious,
  onNext,
  onSwitchToChart,
  onGuideChange,
  onCurrentChord,
  onVoiceTarget,
  midiLive,
  onDrumNotes,
  onSilenceDrums,
  onRequestMidi,
  children,
}: {
  setlistName: string;
  song: SetlistSong & { music: SetlistScoreGuide };
  index: number;
  count: number;
  keepPlaying?: boolean;
  minimized?: boolean;
  onKeepPlayingChange?: (keepPlaying: boolean) => void;
  onPlayingChange?: (playing: boolean) => void;
  onPlaybackEnded?: () => void;
  playbackRef?: React.MutableRefObject<{ stop: () => void } | null>;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSwitchToChart?: () => void;
  onGuideChange: (guide: SetlistScoreGuide) => void;
  onCurrentChord: (chord: string | null) => void;
  onVoiceTarget: (target: AlphaTabVoiceTarget | null) => void;
  midiLive: boolean;
  onDrumNotes: (notes: readonly number[], velocity: number, down: boolean) => void;
  onSilenceDrums: () => void;
  onRequestMidi: () => void;
  children?: React.ReactNode;
}) {
  const guide = song.music;
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const guideRef = useRef(guide);
  const lastChordRef = useRef<string | null>(null);
  const callbacksRef = useRef({
    onGuideChange,
    onCurrentChord,
    onVoiceTarget,
    onDrumNotes,
    onSilenceDrums,
    onPlayingChange,
    onPlaybackEnded,
  });
  callbacksRef.current = {
    onGuideChange,
    onCurrentChord,
    onVoiceTarget,
    onDrumNotes,
    onSilenceDrums,
    onPlayingChange,
    onPlaybackEnded,
  };
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
    if (!guide.rc600Drums) callbacksRef.current.onSilenceDrums();
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
          isPercussion: Boolean(
            track?.isPercussion ||
            track?.staves?.some?.((staff: any) => staff?.isPercussion) ||
            /drum|percussion|bateria/i.test(String(track?.name ?? "")),
          ),
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
        if (cancelled) return;
        const nextPlaying = Boolean(args?.state === 1 || args?.state === "playing");
        setPlaying(nextPlaying);
        callbacksRef.current.onPlayingChange?.(nextPlaying);
        if (!nextPlaying) callbacksRef.current.onSilenceDrums();
      });
      api.playerFinished.on(() => {
        if (cancelled) return;
        callbacksRef.current.onSilenceDrums();
        setPlaying(false);
        callbacksRef.current.onPlayingChange?.(false);
        callbacksRef.current.onPlaybackEnded?.();
      });
      api.playerPositionChanged.on((args: any) => {
        if (cancelled) return;
        setPosition(Number(args?.currentTime) || 0);
        setDuration(Number(args?.endTime) || 0);
      });
      api.midiEventsPlayedFilter = [
        alphaTab.midi.MidiEventType.NoteOn,
        alphaTab.midi.MidiEventType.NoteOff,
      ];
      api.midiEventsPlayed.on((args: any) => {
        const currentGuide = guideRef.current;
        if (!currentGuide.rc600Drums || currentGuide.drumTrackIndex === undefined) return;
        const drumTrack = api.score?.tracks?.find(
          (track: any) => track.index === currentGuide.drumTrackIndex,
        );
        if (!drumTrack) return;
        const channels = new Set([
          Number(drumTrack.playbackInfo?.primaryChannel),
          Number(drumTrack.playbackInfo?.secondaryChannel),
        ].filter(Number.isFinite));
        for (const event of args?.events ?? []) {
          const forwarded = alphaTabDrumNote(
            event,
            channels,
            alphaTab.midi.MidiEventType.NoteOn,
            alphaTab.midi.MidiEventType.NoteOff,
          );
          if (forwarded) {
            callbacksRef.current.onDrumNotes(
              [forwarded.note],
              forwarded.velocity,
              forwarded.down,
            );
          }
        }
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
      callbacksRef.current.onSilenceDrums();
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

  const handleStop = () => {
    apiRef.current?.stop();
    callbacksRef.current.onSilenceDrums();
    setPlaying(false);
    callbacksRef.current.onPlayingChange?.(false);
  };

  useEffect(() => {
    if (!playbackRef) return;
    playbackRef.current = { stop: handleStop };
    return () => {
      playbackRef.current = null;
    };
  });

  const detectedDrumTrack =
    tracks.find((track) => track.index === guide.drumTrackIndex) ??
    tracks.find((track) => track.isPercussion);
  const routedDrumIndex = guide.rc600Drums ? detectedDrumTrack?.index : undefined;
  const audibleTrackCount = tracks.filter(
    (track) =>
      !(guide.mutedTrackIndexes ?? []).includes(track.index) &&
      track.index !== routedDrumIndex,
  ).length;

  return (
    <section
      className={`setlist-chart-stage alphatab-stage${minimized ? " is-minimized" : ""}`}
      aria-label={`${song.name} score`}
      aria-hidden={minimized || undefined}
    >
      {!minimized ? (
        <>
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
        {onSwitchToChart ? (
          <button type="button" className="btn ghost" onClick={onSwitchToChart}>
            <Icon name="scene" /> View chart
          </button>
        ) : null}
        <button type="button" className="btn primary" disabled={!ready} onClick={() => apiRef.current?.playPause()}>
          <Icon name={playing ? "pause" : "play"} /> {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="btn ghost" disabled={!ready} onClick={handleStop}>
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
        <Toggle
          label="Keep playing"
          checked={keepPlaying}
          onChange={(next) => onKeepPlayingChange?.(next)}
        />
      </div>
        </>
      ) : null}

      {!minimized && tracks.length ? (
        <div className="alphatab-track-controls">
          <details className="alphatab-multiselect">
            <summary>Visible tracks · {guide.selectedTrackIndexes.length}</summary>
            <div className="alphatab-multiselect-menu">
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
            </div>
          </details>
          <details className="alphatab-multiselect">
            <summary>Audio tracks · {audibleTrackCount}</summary>
            <div className="alphatab-multiselect-menu">
              {tracks.map((track) => {
                const routed = track.index === routedDrumIndex;
                const audible =
                  !routed && !(guide.mutedTrackIndexes ?? []).includes(track.index);
                return (
                  <label key={track.index}>
                    <input
                      type="checkbox"
                      checked={audible}
                      disabled={routed}
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
                    {track.name}{routed ? " · RC-600 MIDI" : ""}
                  </label>
                );
              })}
            </div>
          </details>
          <label className="playlist-field alphatab-vocal-select">
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
          <button
            type="button"
            className={`btn ${guide.rc600Drums ? "primary" : "ghost"}`}
            disabled={!detectedDrumTrack}
            title={
              detectedDrumTrack
                ? `Route ${detectedDrumTrack.name} to the RC-600 rhythm channel`
                : "No drum track was found in this score"
            }
            onClick={() => {
              const enabled = !guide.rc600Drums;
              if (enabled && !midiLive) onRequestMidi();
              if (!enabled) onSilenceDrums();
              onGuideChange({
                ...guide,
                rc600Drums: enabled,
                drumTrackIndex: detectedDrumTrack?.index,
              });
            }}
          >
            <Icon name="midi" />{" "}
            {guide.rc600Drums
              ? midiLive
                ? "RC-600 drums ON"
                : "RC-600 drums · MIDI offline"
              : "Use RC-600 drums"}
          </button>
        </div>
      ) : null}

      {error && !minimized ? <p className="voice-tone-warning" role="alert">{error}</p> : null}
      {!ready && !error && !minimized ? <p className="playlist-status">Loading score…</p> : null}
      <div className="alphatab-scroll" ref={scrollRef}>
        <div className="alphatab-host" ref={hostRef} />
      </div>

      {!minimized ? children : null}

      {!minimized ? (
      <footer className="setlist-chart-stage-foot">
        <button type="button" className="btn ghost" onClick={onPrevious}>Previous</button>
        <button type="button" className="btn primary" onClick={onNext}>Next</button>
      </footer>
      ) : null}
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
