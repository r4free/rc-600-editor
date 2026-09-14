import { useCallback, useEffect, useRef, useState } from "react";
import { convertAudioFileToRc600Wav } from "@rc600/files/convert-audio";
import {
  phraseDurationSeconds,
  phraseTagsForClear,
  phraseTagsForImport,
  trackHasPhrase,
} from "@rc600/files/phrase-tags";
import { formatDuration, wavBytesToAudioBuffer } from "@rc600/files/wav-format";
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

const TRACK_NOS = [1, 2, 3, 4, 5, 6] as const;

type TrackPlayer = {
  source: AudioBufferSourceNode;
  buffer: AudioBuffer;
  /** Buffer offset (seconds) when this source started. */
  offsetSec: number;
  /** ctx.currentTime when this source started. */
  startedAt: number;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function AudioTab({
  model,
  onPatch,
  dirHandle,
  canWrite,
  writeBlockedReason,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  dirHandle: DirectoryHandleLike | null;
  canWrite: boolean;
  writeBlockedReason: string | null;
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
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importTrackRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playersRef = useRef<Map<number, TrackPlayer>>(new Map());
  const buffersRef = useRef<Map<number, AudioBuffer>>(new Map());
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const scrubbingRef = useRef<Set<number>>(new Set());

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
    stopAllTracks();
    buffersRef.current.clear();
    setPositions(Array.from({ length: 6 }, () => 0));
    setDurations(Array.from({ length: 6 }, () => 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on slot change
  }, [model.slot]);

  useEffect(() => {
    return () => {
      stopAllTracks();
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          if (scrubbingRef.current.has(track)) continue;
          const pos = Math.min(
            player.buffer.duration,
            player.offsetSec + (ctx.currentTime - player.startedAt),
          );
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
      const pos = Math.min(
        player.buffer.duration,
        player.offsetSec + (ctx.currentTime - player.startedAt),
      );
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

  function stopAllTracks() {
    for (const track of [...playersRef.current.keys()]) {
      stopTrackSource(track, true);
    }
    setPlayingTracks(new Set());
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
    return buffer;
  }

  function startSource(track: number, buffer: AudioBuffer, offsetSec: number) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    stopTrackSource(track, true);

    const clipped = Math.max(0, Math.min(offsetSec, Math.max(0, buffer.duration - 0.01)));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
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
  const anyPlayable = TRACK_NOS.some((n) => {
    const t = model.tracks[n - 1] ?? {};
    return trackHasPhrase(t) || Boolean(wavInfos[n - 1]);
  });

  return (
    <div className="audio-tab">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aiff,.aif"
        hidden
        onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
      />

      <p className="hint">
        Manage phrase audio under WAVE/ for this memory. Play several tracks at once and drag each
        Position slider to scrub. Large imported songs may take a few seconds to load the first
        time. Import converts audio to RC-600 format (44.1 kHz, 32-bit float, stereo). Save memory
        after import or clear so the pedal sees the new phrase length.
      </p>

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

      {waveProbe?.waveOk ? (
        <p className="hint audio-folder-hint" role="status">
          <Icon name="folderOpen" size={14} /> Folder “{waveProbe.rootName}” connected
          {wavInfos.some(Boolean) ? " — WAVE files ready to play." : "."}
        </p>
      ) : null}

      {localError && !(waveProbe && !waveProbe.waveOk && waveProbe.message === localError) ? (
        <p className="error">{localError}</p>
      ) : null}

      {folderReady ? (
        <div className="audio-transport">
          <button
            type="button"
            className="btn primary"
            disabled={!anyPlayable}
            onClick={() => void playAllRecorded()}
          >
            <Icon name="play" size={14} /> Play all
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!anyPlaying}
            onClick={stopAllTracks}
          >
            <Icon name="stop" size={14} /> Stop all
          </button>
        </div>
      ) : null}

      <div className="channel-grid channel-grid-wide">
        {TRACK_NOS.map((n) => {
          const track = model.tracks[n - 1] ?? {};
          const recorded = trackHasPhrase(track);
          const rc0Duration = phraseDurationSeconds(track);
          const bufDuration = durations[n - 1] || 0;
          const durationSec = bufDuration || rc0Duration;
          const durationLabel = durationSec > 0 ? formatDuration(durationSec) : "—";
          const wav = wavInfos[n - 1] ?? null;
          const busy = busyTracks.has(n);
          const playing = playingTracks.has(n);
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

          return (
            <section key={n} className="channel-card audio-track-card">
              <h3 className="section-title">
                <Icon name="mfx" size={14} /> Track {n}
              </h3>

              <div className="param-columns">
                <div className="param-row readonly">
                  <div className="param-label">
                    <span>Phrase</span>
                    <InfoTip
                      label="Phrase"
                      text="Recorded when RC0 tag X is greater than zero (stereo frame count of the WAV). Empty tracks keep X at 0."
                    />
                  </div>
                  <div className="param-control">
                    <span className="param-val">{recorded ? "Recorded" : "Empty"}</span>
                  </div>
                </div>

                <div className="param-row readonly">
                  <div className="param-label">
                    <span>Duration</span>
                  </div>
                  <div className="param-control">
                    <span className="param-val">{recorded || bufDuration ? durationLabel : "—"}</span>
                  </div>
                </div>

                <div className="param-row readonly">
                  <div className="param-label">
                    <span>File</span>
                  </div>
                  <div className="param-control">
                    <span className="param-val audio-file-meta">
                      {wav
                        ? `${wav.fileName} · ${formatBytes(wav.size)}`
                        : !folderReady
                          ? "n/a"
                          : recorded
                            ? "On USB — press Play to load"
                            : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {(recorded || hasFile) && folderReady ? (
                <div className="audio-seek">
                  <label className="audio-seek-label" htmlFor={`audio-seek-${n}`}>
                    Position
                  </label>
                  <input
                    id={`audio-seek-${n}`}
                    type="range"
                    min={0}
                    max={Math.max(durationSec, 0.1)}
                    step={0.05}
                    value={Math.min(pos, Math.max(durationSec, 0.1))}
                    disabled={!playOk && !playing}
                    onPointerDown={() => scrubbingRef.current.add(n)}
                    onPointerUp={() => scrubbingRef.current.delete(n)}
                    onChange={(e) => seekTrack(n, Number(e.target.value))}
                  />
                  <div className="audio-seek-readout">
                    {formatClock(pos)} / {formatClock(durationSec)}
                  </div>
                </div>
              ) : null}

              <div className="audio-track-actions">
                {playing ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => stopTrackSource(n)}
                  >
                    <Icon name="stop" size={14} /> Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!playOk}
                    title={playDisabledReason ?? "Play this track (other tracks keep playing)"}
                    onClick={() => void playTrack(n)}
                  >
                    <Icon name="play" size={14} /> Play
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!writeOk}
                  onClick={() => requestImport(n)}
                >
                  <Icon name="upload" size={14} /> Import
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!exportOk}
                  title="Export this track WAV"
                  onClick={() => void exportTrack(n)}
                >
                  <Icon name="download" size={14} /> Export
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!writeOk || (!recorded && !wav)}
                  onClick={() => void clearTrack(n)}
                >
                  <Icon name="deleteOutline" size={14} /> Clear
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
