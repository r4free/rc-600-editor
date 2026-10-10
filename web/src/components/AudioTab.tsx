import { useCallback, useEffect, useRef, useState } from "react";
import { convertAudioFileToRc600Wav } from "@rc600/files/convert-audio";
import {
  phraseDurationSeconds,
  phraseTagsForClear,
  phraseTagsForImport,
  trackHasPhrase,
} from "@rc600/files/phrase-tags";
import { wavBytesToAudioBuffer } from "@rc600/files/wav-format";
import {
  clearTrackWav,
  listMemoryTrackWavs,
  probeWaveAccess,
  readTrackWav,
  rememberWavFileName,
  writeTrackWav,
  type TrackWavInfo,
  type WaveAccessProbe,
} from "@rc600/files/wave";
import type { DirectoryHandleLike } from "@rc600/files/roland";
import { memoryTempo, type MemoryModel } from "@rc600/rc0/memory";
import { fetchMemoryWaveFiles, fetchTrackWaveFile } from "../api";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";
import type { PatchHandler } from "./LoopTab";
import { computePeaks, WaveformSeek } from "./WaveformSeek";

const TRACK_NOS = [1, 2, 3, 4, 5, 6] as const;

type TrackPlayer = {
  source: AudioBufferSourceNode;
  buffer: AudioBuffer;
  /** Buffer offset (seconds) when this source started. */
  offsetSec: number;
  /** ctx.currentTime when this source started. */
  startedAt: number;
};

function playerPosition(player: TrackPlayer, now: number): number {
  const duration = player.buffer.duration;
  const pos = player.offsetSec + (now - player.startedAt);
  if (player.source.loop && duration > 0) return pos % duration;
  return Math.min(duration, pos);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioTab({
  model,
  onPatch,
  dirHandle,
  canWrite,
  writeBlockedReason,
  offline = false,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  dirHandle: DirectoryHandleLike | null;
  canWrite: boolean;
  writeBlockedReason: string | null;
  offline?: boolean;
}) {
  const [wavInfos, setWavInfos] = useState<Array<TrackWavInfo | null>>(() =>
    Array.from({ length: 6 }, () => null),
  );
  const [waveProbe, setWaveProbe] = useState<WaveAccessProbe | null>(null);
  const [busyTracks, setBusyTracks] = useState<Set<number>>(() => new Set());
  const [playingTracks, setPlayingTracks] = useState<Set<number>>(() => new Set());
  /** Current playhead per track (seconds). */
  const [positions, setPositions] = useState<number[]>(() => Array.from({ length: 6 }, () => 0));
  /** Decoded duration per track (seconds); 0 if unknown. */
  const [durations, setDurations] = useState<number[]>(() => Array.from({ length: 6 }, () => 0));
  /** Waveform peaks per track once the WAV is decoded. */
  const [peaks, setPeaks] = useState<Array<number[] | null>>(() =>
    Array.from({ length: 6 }, () => null),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importTrackRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playersRef = useRef<Map<number, TrackPlayer>>(new Map());
  const buffersRef = useRef<Map<number, AudioBuffer>>(new Map());
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  /** Tracks whose Playback (tag B, 1 Shot) is Loop. */
  const loopTracks = new Set<number>(
    TRACK_NOS.filter((n) => Number(model.tracks[n - 1]?.B ?? 0) === 0),
  );
  const loopTracksRef = useRef(loopTracks);
  loopTracksRef.current = loopTracks;
  const loopKey = [...loopTracks].join(",");

  const folderReady = Boolean(dirHandle);

  const refreshWavs = useCallback(async () => {
    if (!dirHandle) {
      setWavInfos(Array.from({ length: 6 }, () => null));
      setWaveProbe(null);
      return;
    }
    try {
      const { files, probe } = await listMemoryTrackWavs(dirHandle, model.slot);
      let merged = files;

      // Always ask the local API — it sees AFTERL~1.WAV on the USB even when
      // the browser directory listing returns empty.
      const serverTracks = await fetchMemoryWaveFiles(model.slot);
      if (serverTracks) {
        merged = TRACK_NOS.map((n) => {
          const i = n - 1;
          const s = serverTracks[i];
          if (s) {
            rememberWavFileName(model.slot, n, s.fileName);
            return {
              path: `WAVE/${String(model.slot).padStart(3, "0")}_${n}/${s.fileName}`,
              fileName: s.fileName,
              size: s.size,
            };
          }
          return files[i] ?? null;
        });
      }

      setWavInfos(merged);
      setWaveProbe(probe);
      if (!probe.waveOk && probe.message && !serverTracks?.some(Boolean)) {
        setLocalError(probe.message);
      } else {
        setLocalError(null);
      }
    } catch (e) {
      setLocalError(String(e));
      try {
        setWaveProbe(await probeWaveAccess(dirHandle));
      } catch {
        setWaveProbe(null);
      }
    }
  }, [dirHandle, model.slot]);

  useEffect(() => {
    void refreshWavs();
  }, [refreshWavs]);

  // Clear players when switching memory
  useEffect(() => {
    pauseAllTracks();
    buffersRef.current.clear();
    setPositions(Array.from({ length: 6 }, () => 0));
    setDurations(Array.from({ length: 6 }, () => 0));
    setPeaks(Array.from({ length: 6 }, () => null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on slot change
  }, [model.slot]);

  useEffect(() => {
    return () => {
      pauseAllTracks();
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    for (const [track, player] of playersRef.current) {
      const loop = loopTracksRef.current.has(track);
      if (player.source.loop === loop) continue;
      // Rebase so the playhead stays correct after the loop flag flips mid-playback.
      player.offsetSec = playerPosition(player, ctx.currentTime);
      player.startedAt = ctx.currentTime;
      player.source.loop = loop;
    }
  }, [loopKey]);

  // Animate playheads
  useEffect(() => {
    if (playingTracks.size === 0) return;
    let raf = 0;
    const tick = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      setPositions((prev) => {
        const next = [...prev];
        let changed = false;
        for (const [track, player] of playersRef.current) {
          const pos = playerPosition(player, ctx.currentTime);
          const i = track - 1;
          if (Math.abs((next[i] ?? 0) - pos) > 0.05) {
            next[i] = pos;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playingTracks]);

  function markBusy(track: number, on: boolean) {
    setBusyTracks((prev) => {
      const next = new Set(prev);
      if (on) next.add(track);
      else next.delete(track);
      return next;
    });
  }

  function setPlaying(track: number, on: boolean) {
    setPlayingTracks((prev) => {
      const next = new Set(prev);
      if (on) next.add(track);
      else next.delete(track);
      return next;
    });
  }

  function stopTrackSource(track: number, keepPosition = false) {
    const player = playersRef.current.get(track);
    if (!player) {
      setPlaying(track, false);
      return;
    }
    const ctx = audioCtxRef.current;
    if (ctx && !keepPosition) {
      const pos = playerPosition(player, ctx.currentTime);
      setPositions((prev) => {
        const next = [...prev];
        next[track - 1] = pos;
        return next;
      });
    }
    try {
      player.source.onended = null;
      player.source.stop();
    } catch {
      /* already stopped */
    }
    playersRef.current.delete(track);
    setPlaying(track, false);
  }

  function toggleLoop(track: number) {
    const loop = loopTracksRef.current.has(track);
    onPatch({ type: "track", track, tags: { B: loop ? "1" : "0" } });
  }

  function stopTrack(track: number) {
    stopTrackSource(track, true);
    setPositions((prev) => {
      const next = [...prev];
      next[track - 1] = 0;
      return next;
    });
  }

  function pauseAllTracks() {
    for (const track of [...playersRef.current.keys()]) {
      stopTrackSource(track);
    }
    setPlayingTracks(new Set());
  }

  function stopAllTracks() {
    for (const track of [...playersRef.current.keys()]) {
      stopTrackSource(track, true);
    }
    setPlayingTracks(new Set());
    setPositions(Array.from({ length: 6 }, () => 0));
  }

  async function ensureCtx(): Promise<AudioContext> {
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  async function loadTrackBytes(
    track: number,
  ): Promise<{ info: TrackWavInfo; bytes: Uint8Array } | null> {
    // Prefer the local API: Node can list FAT/USB 8.3 names (AFTERL~1.WAV) that
    // the browser File System Access API often cannot enumerate.
    const fromServer = await fetchTrackWaveFile(model.slot, track);
    if (fromServer) {
      const info: TrackWavInfo = {
        path: `WAVE/${String(model.slot).padStart(3, "0")}_${track}/${fromServer.fileName}`,
        fileName: fromServer.fileName,
        size: fromServer.bytes.byteLength,
      };
      rememberWavFileName(model.slot, track, fromServer.fileName);
      setWavInfos((prev) => {
        const next = [...prev];
        next[track - 1] = info;
        return next;
      });
      return { info, bytes: fromServer.bytes };
    }

    if (!dirHandle) return null;
    const fromBrowser = await readTrackWav(dirHandle, model.slot, track);
    if (fromBrowser) {
      rememberWavFileName(model.slot, track, fromBrowser.info.fileName);
      setWavInfos((prev) => {
        const next = [...prev];
        next[track - 1] = fromBrowser.info;
        return next;
      });
      return fromBrowser;
    }

    return null;
  }

  async function ensureBuffer(track: number): Promise<AudioBuffer | null> {
    const cached = buffersRef.current.get(track);
    if (cached) return cached;
    const loaded = await loadTrackBytes(track);
    if (!loaded) return null;
    const ctx = await ensureCtx();
    const buffer = (await wavBytesToAudioBuffer(ctx, loaded.bytes)) as AudioBuffer;
    buffersRef.current.set(track, buffer);
    setDurations((prev) => {
      const next = [...prev];
      next[track - 1] = buffer.duration;
      return next;
    });
    const trackPeaks = computePeaks(buffer);
    setPeaks((prev) => {
      const next = [...prev];
      next[track - 1] = trackPeaks;
      return next;
    });
    return buffer;
  }

  function startSource(track: number, buffer: AudioBuffer, offsetSec: number) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    stopTrackSource(track, true);

    const clipped = Math.max(0, Math.min(offsetSec, Math.max(0, buffer.duration - 0.01)));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loopTracksRef.current.has(track);
    src.connect(ctx.destination);
    src.onended = () => {
      const cur = playersRef.current.get(track);
      if (cur?.source !== src) return;
      playersRef.current.delete(track);
      setPlaying(track, false);
      setPositions((prev) => {
        const next = [...prev];
        next[track - 1] = buffer.duration;
        return next;
      });
    };
    const startedAt = ctx.currentTime;
    src.start(0, clipped);
    playersRef.current.set(track, { source: src, buffer, offsetSec: clipped, startedAt });
    setPlaying(track, true);
    setPositions((prev) => {
      const next = [...prev];
      next[track - 1] = clipped;
      return next;
    });
  }

  async function playTrack(track: number, fromOffset?: number) {
    if (!dirHandle) return;
    setLocalError(null);
    markBusy(track, true);
    try {
      const buffer = await ensureBuffer(track);
      if (!buffer) {
        setLocalError(
          `Track ${track}: no WAV found under WAVE/${String(model.slot).padStart(3, "0")}_${track}/. Keep USB Storage connected and the local API running (npm run dev).`,
        );
        return;
      }
      await ensureCtx();
      const offset = fromOffset ?? positionsRef.current[track - 1] ?? 0;
      // Restart from start if already at/near the end
      const startAt = offset >= buffer.duration - 0.05 ? 0 : offset;
      startSource(track, buffer, startAt);
    } catch (e) {
      setLocalError(String(e));
      setPlaying(track, false);
    } finally {
      markBusy(track, false);
    }
  }

  async function playAllRecorded() {
    setLocalError(null);
    const targets = TRACK_NOS.filter((n) => {
      const track = model.tracks[n - 1] ?? {};
      return trackHasPhrase(track) || Boolean(wavInfos[n - 1]);
    });
    if (targets.length === 0) {
      setLocalError("No recorded tracks to play.");
      return;
    }
    await ensureCtx();
    // Load buffers first, then start together near the same time
    const ready: Array<{ track: number; buffer: AudioBuffer }> = [];
    for (const n of targets) {
      markBusy(n, true);
      try {
        const buffer = await ensureBuffer(n);
        if (buffer) ready.push({ track: n, buffer });
      } catch (e) {
        setLocalError(String(e));
      } finally {
        markBusy(n, false);
      }
    }
    for (const { track, buffer } of ready) {
      const offset = positionsRef.current[track - 1] ?? 0;
      const startAt = offset >= buffer.duration - 0.05 ? 0 : offset;
      startSource(track, buffer, startAt);
    }
  }

  function seekTrack(track: number, seconds: number) {
    const buffer = buffersRef.current.get(track);
    const duration =
      buffer?.duration ||
      durations[track - 1] ||
      phraseDurationSeconds(model.tracks[track - 1] ?? {});
    const clipped = Math.max(0, Math.min(seconds, duration || seconds));
    setPositions((prev) => {
      const next = [...prev];
      next[track - 1] = clipped;
      return next;
    });
    if (playersRef.current.has(track) && buffer) {
      startSource(track, buffer, clipped);
    }
  }

  async function exportTrack(track: number) {
    if (!dirHandle) return;
    setLocalError(null);
    markBusy(track, true);
    try {
      const loaded = await loadTrackBytes(track);
      if (!loaded) {
        setLocalError(`Track ${track} has no WAV file to export.`);
        return;
      }
      const blob = new Blob(
        [
          loaded.bytes.buffer.slice(
            loaded.bytes.byteOffset,
            loaded.bytes.byteOffset + loaded.bytes.byteLength,
          ) as ArrayBuffer,
        ],
        { type: "audio/wav" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = loaded.info.fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setLocalError(String(e));
    } finally {
      markBusy(track, false);
    }
  }

  function requestImport(track: number) {
    if (!canWrite || !dirHandle) return;
    importTrackRef.current = track;
    fileInputRef.current?.click();
  }

  async function onImportFile(file: File | null) {
    const track = importTrackRef.current;
    importTrackRef.current = null;
    if (!file || track == null || !dirHandle) return;
    if (!canWrite) {
      setLocalError(writeBlockedReason ?? "Writing is blocked.");
      return;
    }
    setLocalError(null);
    markBusy(track, true);
    stopTrackSource(track, true);
    buffersRef.current.delete(track);
    setPeaks((prev) => {
      const next = [...prev];
      next[track - 1] = null;
      return next;
    });
    try {
      const { wav, frames } = await convertAudioFileToRc600Wav(await file.arrayBuffer());
      const info = await writeTrackWav(dirHandle, model.slot, track, wav);
      setWavInfos((prev) => {
        const next = [...prev];
        next[track - 1] = info;
        return next;
      });
      setPositions((prev) => {
        const next = [...prev];
        next[track - 1] = 0;
        return next;
      });
      const tempo = memoryTempo(model);
      onPatch({
        type: "track",
        track,
        tags: phraseTagsForImport(frames, tempo),
      });
    } catch (e) {
      setLocalError(String(e));
    } finally {
      markBusy(track, false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function clearTrack(track: number) {
    if (!dirHandle || !canWrite) return;
    if (!window.confirm(`Clear audio on Track ${track}? The WAV file will be deleted.`)) return;
    setLocalError(null);
    markBusy(track, true);
    stopTrackSource(track, true);
    buffersRef.current.delete(track);
    setPeaks((prev) => {
      const next = [...prev];
      next[track - 1] = null;
      return next;
    });
    try {
      await clearTrackWav(dirHandle, model.slot, track);
      setWavInfos((prev) => {
        const next = [...prev];
        next[track - 1] = null;
        return next;
      });
      setPositions((prev) => {
        const next = [...prev];
        next[track - 1] = 0;
        return next;
      });
      setDurations((prev) => {
        const next = [...prev];
        next[track - 1] = 0;
        return next;
      });
      onPatch({ type: "track", track, tags: phraseTagsForClear() });
    } catch (e) {
      setLocalError(String(e));
    } finally {
      markBusy(track, false);
    }
  }

  const anyPlaying = playingTracks.size > 0;
  const playableCount = TRACK_NOS.filter((n) => {
    const t = model.tracks[n - 1] ?? {};
    return trackHasPhrase(t) || Boolean(wavInfos[n - 1]);
  }).length;
  const anyPlayable = playableCount > 0;
  const allPlaying = anyPlayable && playingTracks.size >= playableCount;
  const anyMoved = positions.some((p) => p > 0);

  if (offline) {
    return (
      <div className="audio-tab">
        <p className="hint audio-folder-hint" role="status">
          <Icon name="folderOpen" size={14} /> Track audio is not available while editing offline.
          Connect the RC-600 over USB to play, import, export, or clear track WAV files.
        </p>
      </div>
    );
  }

  return (
    <div className="audio-tab">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aiff,.aif"
        hidden
        onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
      />

      {!folderReady ? (
        <p className="hint audio-folder-hint" role="status">
          <Icon name="folderOpen" size={14} /> Open the ROLAND folder (Chrome/Edge) to play, import,
          export, or clear track WAV files. Demo and ZIP mode only show phrase length from the RC0 —
          they do not include WAVE audio.
        </p>
      ) : null}

      {writeBlockedReason && folderReady ? (
        <p className="hint audio-folder-hint" role="status">
          <Icon name="alert" size={14} /> {writeBlockedReason}
        </p>
      ) : null}

      {waveProbe && !waveProbe.waveOk && waveProbe.message ? (
        <p className="hint audio-folder-hint" role="status">
          <Icon name="alert" size={14} /> {waveProbe.message}
        </p>
      ) : null}

      {localError && !(waveProbe && !waveProbe.waveOk && waveProbe.message === localError) ? (
        <p className="error">{localError}</p>
      ) : null}

      <div
        className={`audio-transport${anyPlaying ? " is-playing" : ""}${folderReady ? "" : " is-bare"}`}
      >
        {folderReady ? (
          <>
            <div className="audio-transport-buttons" role="group" aria-label="All tracks">
              <button
                type="button"
                className={`audio-transport-btn play${anyPlaying ? " is-active" : ""}`}
                disabled={!anyPlayable || allPlaying}
                title="Play every track that has audio, from its current position"
                onClick={() => void playAllRecorded()}
              >
                <Icon name="play" size={18} />
                <span>Play all</span>
              </button>
              <button
                type="button"
                className="audio-transport-btn"
                disabled={!anyPlaying}
                title="Pause every track and keep its position"
                onClick={pauseAllTracks}
              >
                <Icon name="pause" size={18} />
                <span>Pause all</span>
              </button>
              <button
                type="button"
                className="audio-transport-btn"
                disabled={!anyPlaying && !anyMoved}
                title="Stop every track and return to the start"
                onClick={stopAllTracks}
              >
                <Icon name="stop" size={18} />
                <span>Stop all</span>
              </button>
            </div>
            <span className="audio-transport-status" role="status">
              <span className="audio-transport-led" aria-hidden="true" />
              {anyPlaying
                ? `${playingTracks.size} of ${playableCount} playing`
                : playableCount > 0
                  ? `${playableCount} ${playableCount === 1 ? "track" : "tracks"} with audio`
                  : "No tracks with audio"}
            </span>
          </>
        ) : null}
        <span className="tabs-help">
          <InfoTip
            label="Audio"
            text="Manage phrase audio under WAVE/ for this memory. Play several tracks at once and click or drag each waveform to jump to a position. Pause keeps the position; Stop returns to the start. Large imported songs may take a few seconds to load the first time. Import converts audio to RC-600 format (44.1 kHz, 32-bit float, stereo). Save memory after import or clear so the pedal sees the new phrase length."
          />
        </span>
      </div>

      <div className="audio-track-grid">
        {TRACK_NOS.map((n) => {
          const track = model.tracks[n - 1] ?? {};
          const recorded = trackHasPhrase(track);
          const rc0Duration = phraseDurationSeconds(track);
          const bufDuration = durations[n - 1] || 0;
          const durationSec = bufDuration || rc0Duration;
          const wav = wavInfos[n - 1] ?? null;
          const busy = busyTracks.has(n);
          const playing = playingTracks.has(n);
          const looping = loopTracks.has(n);
          const pos = positions[n - 1] ?? 0;
          const writeOk = folderReady && canWrite && !busy;
          const hasFile = Boolean(wav);
          const playOk = folderReady && !busy && (hasFile || recorded);
          const exportOk = folderReady && !busy && (hasFile || recorded);
          const playDisabledReason = !folderReady
            ? "Open the ROLAND folder to play track audio"
            : !hasFile && !recorded
              ? "No phrase audio on this track"
              : busy
                ? "Busy"
                : null;
          const hasAudio = recorded || hasFile;
          const fileLabel = wav
            ? wav.fileName
            : !folderReady
              ? hasAudio
                ? "Open the ROLAND folder to load audio"
                : "No audio"
              : recorded
                ? "On USB — press Play to load"
                : "No audio";
          const cardClass = [
            "audio-track-card",
            hasAudio ? "has-audio" : "is-empty",
            playing ? "is-playing" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <section key={n} className={cardClass} data-track={n}>
              <header className="audio-track-head">
                <h3 className="audio-track-title">
                  <Icon name="mfx" size={16} /> Track {n}
                </h3>
                <span
                  className="audio-track-status"
                  role="img"
                  aria-label={hasAudio ? "Has audio" : "Empty"}
                  title={
                    hasAudio
                      ? "This track has audio (RC0 tag X greater than zero)"
                      : "This track is empty"
                  }
                />
              </header>

              <div
                className="audio-file-line"
                title={wav ? `${wav.fileName} · ${formatBytes(wav.size)}` : fileLabel}
              >
                <Icon name="fileMusic" size={14} />
                <span className="audio-file-name">{fileLabel}</span>
                {wav ? <span className="audio-file-size">{formatBytes(wav.size)}</span> : null}
              </div>

              <WaveformSeek
                label={`Track ${n} position`}
                seed={n}
                peaks={peaks[n - 1] ?? null}
                position={pos}
                duration={durationSec}
                hasAudio={hasAudio}
                disabled={!playOk && !playing}
                onSeek={(sec) => seekTrack(n, sec)}
              />

              <div className="audio-track-actions">
                <button
                  type="button"
                  className={`audio-icon-btn transport play${playing ? " is-active" : ""}`}
                  disabled={!playOk || playing}
                  title={
                    playing
                      ? "Playing"
                      : (playDisabledReason ?? "Play this track (other tracks keep playing)")
                  }
                  aria-label={`Play track ${n}`}
                  aria-pressed={playing}
                  onClick={() => void playTrack(n)}
                >
                  <Icon name="play" size={18} />
                </button>
                <button
                  type="button"
                  className="audio-icon-btn transport"
                  disabled={!playing || busy}
                  title="Pause (keeps the position)"
                  aria-label={`Pause track ${n}`}
                  onClick={() => stopTrackSource(n)}
                >
                  <Icon name="pause" size={18} />
                </button>
                <button
                  type="button"
                  className="audio-icon-btn transport"
                  disabled={!playing && pos <= 0}
                  title="Stop and return to the start"
                  aria-label={`Stop track ${n}`}
                  onClick={() => stopTrack(n)}
                >
                  <Icon name="stop" size={18} />
                </button>
                <button
                  type="button"
                  className={`audio-icon-btn transport playback ${looping ? "is-loop" : "is-one-shot"}`}
                  title={
                    looping
                      ? "Playback: Loop — the track repeats. Click to switch to 1 Shot."
                      : "Playback: 1 Shot — the track plays once, then stops. Click to switch to Loop."
                  }
                  aria-label={`Track ${n} playback: ${looping ? "Loop" : "1 Shot"}`}
                  onClick={() => toggleLoop(n)}
                >
                  <Icon name={looping ? "loop" : "oneShot"} size={17} />
                </button>
                <span className="audio-actions-spacer" />
                <button
                  type="button"
                  className="audio-icon-btn"
                  disabled={!writeOk}
                  title="Import audio file into this track"
                  aria-label={`Import audio into track ${n}`}
                  onClick={() => requestImport(n)}
                >
                  <Icon name="importAudio" size={17} />
                </button>
                <button
                  type="button"
                  className="audio-icon-btn"
                  disabled={!exportOk}
                  title="Export this track WAV"
                  aria-label={`Export track ${n} WAV`}
                  onClick={() => void exportTrack(n)}
                >
                  <Icon name="exportAudio" size={17} />
                </button>
                <button
                  type="button"
                  className="audio-icon-btn danger"
                  disabled={!writeOk || !hasAudio}
                  title="Clear this track (deletes the WAV)"
                  aria-label={`Clear track ${n}`}
                  onClick={() => void clearTrack(n)}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
