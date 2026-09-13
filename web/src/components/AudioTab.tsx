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
  const [busyTrack, setBusyTrack] = useState<number | null>(null);
  const [playingTrack, setPlayingTrack] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importTrackRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

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

      // Browser File System Access often cannot list 8.3 names (AFTERL~1.WAV) on USB/FAT.
      // Fall back to the local API, which reads ROLAND/WAVE via Node.
      if (merged.every((f) => !f) || merged.some((f) => !f)) {
        const serverTracks = await fetchMemoryWaveFiles(model.slot);
        if (serverTracks) {
          merged = merged.map((browser, i) => {
            if (browser) return browser;
            const s = serverTracks[i];
            if (!s) return null;
            rememberWavFileName(model.slot, i + 1, s.fileName);
            return {
              path: `WAVE/${String(model.slot).padStart(3, "0")}_${i + 1}/${s.fileName}`,
              fileName: s.fileName,
              size: s.size,
            };
          });
        }
      }

      setWavInfos(merged);
      setWaveProbe(probe);
      if (!probe.waveOk && probe.message) {
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

  useEffect(() => {
    return () => {
      try {
        sourceRef.current?.stop();
      } catch {
        /* already stopped */
      }
      sourceRef.current = null;
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  function stopPlayback() {
    try {
      sourceRef.current?.stop();
    } catch {
      /* already stopped */
    }
    sourceRef.current = null;
    setPlayingTrack(null);
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
    if (!dirHandle) return null;

    // 1) Browser folder handle (works for canonical {NNN}_{T}.WAV)
    const fromBrowser = await readTrackWav(dirHandle, model.slot, track);
    if (fromBrowser) {
      rememberWavFileName(model.slot, track, fromBrowser.info.fileName);
      return fromBrowser;
    }

    // 2) Local API — Node reads USB/FAT including 8.3 names like AFTERL~1.WAV
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

    return null;
  }

  async function playTrack(track: number) {
    if (!dirHandle) return;
    setLocalError(null);
    stopPlayback();
    setBusyTrack(track);
    try {
      const loaded = await loadTrackBytes(track);
      if (!loaded) {
        setLocalError(
          `Track ${track}: no WAV found under WAVE/${String(model.slot).padStart(3, "0")}_${track}/. Keep the RC-600 in USB Storage and run the local API (npm run dev).`,
        );
        return;
      }
      const ctx = await ensureCtx();
      const buffer = await wavBytesToAudioBuffer(ctx, loaded.bytes);
      const src = ctx.createBufferSource();
      src.buffer = buffer as AudioBuffer;
      src.connect(ctx.destination);
      src.onended = () => {
        if (sourceRef.current === src) {
          sourceRef.current = null;
          setPlayingTrack(null);
        }
      };
      sourceRef.current = src;
      setPlayingTrack(track);
      src.start(0);
    } catch (e) {
      setLocalError(String(e));
      setPlayingTrack(null);
    } finally {
      setBusyTrack(null);
    }
  }

  async function exportTrack(track: number) {
    if (!dirHandle) return;
    setLocalError(null);
    setBusyTrack(track);
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
      setBusyTrack(null);
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
    setBusyTrack(track);
    stopPlayback();
    try {
      const { wav, frames } = await convertAudioFileToRc600Wav(await file.arrayBuffer());
      const info = await writeTrackWav(dirHandle, model.slot, track, wav);
      setWavInfos((prev) => {
        const next = [...prev];
        next[track - 1] = info;
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
      setBusyTrack(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function clearTrack(track: number) {
    if (!dirHandle || !canWrite) return;
    if (!window.confirm(`Clear audio on Track ${track}? The WAV file will be deleted.`)) return;
    setLocalError(null);
    setBusyTrack(track);
    if (playingTrack === track) stopPlayback();
    try {
      await clearTrackWav(dirHandle, model.slot, track);
      setWavInfos((prev) => {
        const next = [...prev];
        next[track - 1] = null;
        return next;
      });
      onPatch({ type: "track", track, tags: phraseTagsForClear() });
    } catch (e) {
      setLocalError(String(e));
    } finally {
      setBusyTrack(null);
    }
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

      <p className="hint">
        Manage phrase audio under WAVE/ for this memory. Import converts any common audio to RC-600
        format (44.1 kHz, 32-bit float, stereo). Play reads the WAV from the USB drive via the local
        API (no file picker). Save memory after import or clear so the pedal sees the new phrase
        length.
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
          <Icon name="folderOpen" size={14} /> Reading WAVE/ from “{waveProbe.rootName}”.
        </p>
      ) : null}

      {localError && !(waveProbe && !waveProbe.waveOk && waveProbe.message === localError) ? (
        <p className="error">{localError}</p>
      ) : null}

      <div className="channel-grid channel-grid-wide">
        {TRACK_NOS.map((n) => {
          const track = model.tracks[n - 1] ?? {};
          const recorded = trackHasPhrase(track);
          const duration = formatDuration(phraseDurationSeconds(track));
          const wav = wavInfos[n - 1] ?? null;
          const busy = busyTrack === n;
          const playing = playingTrack === n;
          const writeOk = folderReady && canWrite && !busy;
          // Play when a file is listed OR RC0 says Recorded (may need a one-time file pick on FAT/USB).
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
                    <span className="param-val">{recorded ? duration : "—"}</span>
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
                            ? "Looking up WAVE…"
                            : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="audio-track-actions">
                {playing ? (
                  <button type="button" className="btn ghost" disabled={busy} onClick={stopPlayback}>
                    <Icon name="stop" size={14} /> Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!playOk}
                    title={playDisabledReason ?? "Play this track"}
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
                  title={
                    hasFile
                      ? "Export this track WAV"
                      : "Export — you may need to pick the WAV file once"
                  }
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
