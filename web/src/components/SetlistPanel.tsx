import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  executeSetlistSong,
  newSetlistId,
  newSetlistItemId,
  normalizeSetlistName,
  reorderSetlistSong,
  type Setlist,
  type SetlistMidiAction,
  type SetlistScoreGuide,
  type SetlistScrollGuide,
  type SetlistSong,
} from "../presets/playlist";
import {
  createSetlistTransferArchive,
  mergeImportedSetlists,
  parseSetlistTransferFile,
} from "../presets/playlistTransfer";
import { userSetlistStore } from "../presets/userPlaylistStore";
import { scoreAssetStore } from "../setlists/scoreAssetStore";
import { Icon } from "./Icon";
import { SetlistSongMusicEditor } from "./SetlistSongMusicEditor";
import { SetlistChartViewer } from "./SetlistChartViewer";
import { VoiceToneMonitor } from "./VoiceToneMonitor";
import { transposeKeyRoot } from "../setlists/chordChart";
import { AlphaTabScoreViewer, type AlphaTabVoiceTarget } from "./AlphaTabScoreViewer";

interface MemoryOption {
  slot: number;
  name: string;
}

function briefActions(actions: readonly SetlistMidiAction[]): string {
  if (!actions.length) return "None";
  const shown = actions.slice(0, 3).map((action) => `CC${action.controller}`);
  if (actions.length > shown.length) shown.push(`+${actions.length - shown.length} more`);
  return shown.join(" → ");
}

export function SetlistPanel({
  midiLive,
  usbStorageActive,
  memories,
  currentSlot,
  defaultMidiChannel,
  onRecallMemory,
  onSendControlChange,
  onPlayNotes,
  onSilenceDrums,
  onRequestMidi,
}: {
  midiLive: boolean;
  usbStorageActive: boolean;
  memories: readonly MemoryOption[];
  currentSlot?: number | null;
  defaultMidiChannel: number;
  onRecallMemory: (slot: number) => Promise<void>;
  onSendControlChange: (action: SetlistMidiAction) => void;
  onPlayNotes: (notes: readonly number[], velocity: number, down: boolean) => void;
  onSilenceDrums: () => void;
  onRequestMidi: () => void;
}) {
  const [setlists, setSetlists] = useState<Setlist[]>(() => userSetlistStore.list());
  const [selectedId, setSelectedId] = useState<string | null>(() => setlists[0]?.id ?? null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [expandedSongIds, setExpandedSongIds] = useState<Set<string>>(() => new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [songName, setSongName] = useState("");
  const [songMemory, setSongMemory] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [liveChord, setLiveChord] = useState<string | null>(null);
  const [voiceTarget, setVoiceTarget] = useState<AlphaTabVoiceTarget | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runTokenRef = useRef(0);

  useEffect(() => {
    if (selectedId && setlists.some((setlist) => setlist.id === selectedId)) return;
    setSelectedId(setlists[0]?.id ?? null);
    setActiveIndex(-1);
  }, [selectedId, setlists]);

  const selected = setlists.find((setlist) => setlist.id === selectedId) ?? null;
  const activeSong =
    selected && activeIndex >= 0 ? selected.songs[activeIndex] ?? null : null;
  const memoryBySlot = useMemo(
    () => new Map(memories.map((memory) => [memory.slot, memory.name])),
    [memories],
  );

  function commit(next: Setlist[]) {
    userSetlistStore.replace(next);
    setSetlists(next);
    const referenced = new Set(next.flatMap((setlist) =>
      setlist.songs.flatMap((song) =>
        song.music?.kind === "score" ? [song.music.assetId] : [],
      ),
    ));
    void scoreAssetStore.list().then((assets) =>
      Promise.all(assets.filter((asset) => !referenced.has(asset.id)).map((asset) =>
        scoreAssetStore.delete(asset.id),
      )),
    );
  }

  function updateSelected(patch: (setlist: Setlist) => Setlist) {
    if (!selected) return;
    const nextSetlist = { ...patch(selected), updatedAt: new Date().toISOString() };
    commit(setlists.map((setlist) => (setlist.id === selected.id ? nextSetlist : setlist)));
  }

  function createSetlist() {
    const name = "Untitled setlist";
    const setlist: Setlist = {
      id: newSetlistId(name),
      name,
      updatedAt: new Date().toISOString(),
      songs: [],
    };
    commit([...setlists, setlist].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedId(setlist.id);
    setActiveIndex(-1);
    setViewerOpen(false);
    setEditorOpen(true);
  }

  function openEditor(setlistId: string) {
    runTokenRef.current++;
    setSelectedId(setlistId);
    setActiveIndex(-1);
    setViewerOpen(false);
    setEditorOpen(true);
  }

  function openViewer(setlistId: string) {
    runTokenRef.current++;
    setSelectedId(setlistId);
    setActiveIndex(-1);
    setEditorOpen(false);
    setViewerOpen(true);
  }

  function deleteSetlist() {
    if (!selected) return;
    const next = setlists.filter((setlist) => setlist.id !== selected.id);
    commit(next);
    setSelectedId(next[0]?.id ?? null);
    setDeleteOpen(false);
    setEditorOpen(false);
    setStatus("Setlist deleted");
  }

  function addSong() {
    if (!selected) return;
    const name = songName.trim() || memoryBySlot.get(songMemory) || `Memory ${songMemory}`;
    const song: SetlistSong = {
      id: newSetlistItemId(),
      name: name.slice(0, 80),
      memorySlot: songMemory,
      memoryName: memoryBySlot.get(songMemory) ?? "",
      beforeChange: [],
      afterChange: [],
    };
    updateSelected((setlist) => ({ ...setlist, songs: [...setlist.songs, song] }));
    setExpandedSongIds((current) => new Set(current).add(song.id));
    setSongName("");
    setStatus(`Added ${song.name}`);
  }

  function updateSong(songId: string, patch: (song: SetlistSong) => SetlistSong) {
    updateSelected((setlist) => ({
      ...setlist,
      songs: setlist.songs.map((song) => (song.id === songId ? patch(song) : song)),
    }));
  }

  function addAction(songId: string, phase: "beforeChange" | "afterChange") {
    const action: SetlistMidiAction = {
      id: newSetlistItemId("cc"),
      channel: Math.max(1, Math.min(16, defaultMidiChannel)),
      controller: 1,
      value: 127,
      delayMs: 0,
    };
    updateSong(songId, (song) => ({ ...song, [phase]: [...song[phase], action] }));
  }

  function updateAction(
    songId: string,
    phase: "beforeChange" | "afterChange",
    actionId: string,
    patch: Partial<SetlistMidiAction>,
  ) {
    updateSong(songId, (song) => ({
      ...song,
      [phase]: song[phase].map((action) =>
        action.id === actionId ? { ...action, ...patch } : action,
      ),
    }));
  }

  function moveAction(
    songId: string,
    phase: "beforeChange" | "afterChange",
    actionId: string,
    direction: -1 | 1,
  ) {
    updateSong(songId, (song) => {
      const actions = [...song[phase]];
      const index = actions.findIndex((action) => action.id === actionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= actions.length) return song;
      [actions[index], actions[target]] = [actions[target]!, actions[index]!];
      return { ...song, [phase]: actions };
    });
  }

  const runSong = useCallback(
    async (index: number) => {
      if (!selected?.songs.length) return;
      const wrapped = (index + selected.songs.length) % selected.songs.length;
      const song = selected.songs[wrapped]!;
      const token = ++runTokenRef.current;
      setActiveIndex(wrapped);
      setLiveChord(null);
      setVoiceTarget(null);
      if (!midiLive || usbStorageActive) {
        setStatus(`${song.name} · Live chart selected${usbStorageActive ? " · USB audio unavailable while Storage is active" : ""}`);
        return;
      }
      setStatus(`Changing to ${song.name}…`);
      const completed = await executeSetlistSong(song, {
        sendControlChange: onSendControlChange,
        changeMemory: onRecallMemory,
        isCancelled: () => token !== runTokenRef.current,
      });
      if (!completed) return;
      setStatus(`${song.name} · Memory ${String(song.memorySlot).padStart(2, "0")}`);
    },
    [midiLive, onRecallMemory, onSendControlChange, selected, usbStorageActive],
  );

  useEffect(() => {
    if (!viewerOpen || !selected?.songs.length) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        runTokenRef.current++;
        setViewerOpen(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea, button, [contenteditable='true']")) return;
      if (event.key === "]" || (event.key === "ArrowRight" && activeSong?.music?.kind !== "score")) {
        event.preventDefault();
        void runSong(activeIndex < 0 ? 0 : activeIndex + 1);
      } else if (event.key === "[" || (event.key === "ArrowLeft" && activeSong?.music?.kind !== "score")) {
        event.preventDefault();
        void runSong(activeIndex < 0 ? selected.songs.length - 1 : activeIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, activeSong?.music?.kind, runSong, selected, viewerOpen]);

  useEffect(() => {
    if (!midiLive || currentSlot == null || !selected) return;
    const match = selected.songs.findIndex((song) => song.memorySlot === currentSlot);
    if (match >= 0) setActiveIndex(match);
  }, [currentSlot, midiLive, selected]);

  async function exportSetlists() {
    if (!setlists.length) return;
    try {
      const archive = await createSetlistTransferArchive(setlists, scoreAssetStore);
      const url = URL.createObjectURL(new Blob([new Uint8Array(archive)], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `boss-setlists-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${setlists.length} setlist${setlists.length === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function importSetlists(file: File) {
    try {
      const imported = await parseSetlistTransferFile(file);
      for (const asset of imported.assets ?? []) {
        const stored = await scoreAssetStore.put(asset.fileName, asset.bytes, asset.mediaType);
        if (stored.id !== asset.id) {
          await scoreAssetStore.delete(stored.id);
          throw new Error(`Score checksum mismatch: ${asset.fileName}`);
        }
      }
      const next = mergeImportedSetlists(setlists, imported.setlists);
      commit(next);
      setSelectedId(imported.setlists[0]?.id ?? selectedId);
      setStatus(`Imported ${imported.setlists.length} setlist${imported.setlists.length === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed");
    }
  }

  return (
    <div className="play-drum-body playlist-workspace">
      <section className="playlist-panel is-live">
        <div className="playlist-panel-head">
          <div>
            <span className="playlist-eyebrow">Setlists</span>
            <strong>Choose a setlist to perform</strong>
          </div>
          <div className="setlist-panel-actions">
            <input
              ref={fileRef}
              className="playlist-file-input"
              type="file"
              accept="application/json,application/zip,.json,.zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importSetlists(file);
                event.target.value = "";
              }}
            />
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" /> Import
            </button>
            <button type="button" className="btn ghost" onClick={() => void exportSetlists()} disabled={!setlists.length}>
              <Icon name="download" /> Export
            </button>
            <button type="button" className="btn primary" onClick={createSetlist}>
              New setlist
            </button>
          </div>
        </div>

        {setlists.length ? (
          <div className="setlist-card-grid" role="list" aria-label="Setlists">
            {setlists.map((setlist) => {
              const actionCount = setlist.songs.reduce(
                (count, song) => count + song.beforeChange.length + song.afterChange.length,
                0,
              );
              return (
                <article
                  className="setlist-card"
                  role="listitem"
                  key={setlist.id}
                  tabIndex={0}
                  aria-label={`View ${setlist.name}`}
                  onClick={() => openViewer(setlist.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openViewer(setlist.id);
                    }
                  }}
                >
                  <div>
                    <strong>{setlist.name}</strong>
                    <small>
                      {setlist.songs.length} song{setlist.songs.length === 1 ? "" : "s"} · {actionCount} MIDI action{actionCount === 1 ? "" : "s"}
                    </small>
                  </div>
                  <div className="setlist-card-actions" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="btn ghost"
                      aria-label={`Edit ${setlist.name}`}
                      title="Edit"
                      onClick={() => openEditor(setlist.id)}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      aria-label={`View ${setlist.name}`}
                      title="View"
                      onClick={() => openViewer(setlist.id)}
                    >
                      <Icon name="view" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="playlist-empty">No setlists yet. Create one to start arranging songs.</p>
        )}

        {viewerOpen && selected ? (
          activeSong?.music?.kind === "score" &&
          activeSong.music.liveView === "scroll" &&
          activeSong.music.scrollGuide ? (
            <SetlistChartViewer
              setlistName={selected.name}
              song={{
                ...activeSong,
                music: activeSong.music.scrollGuide,
              }}
              index={activeIndex}
              count={selected.songs.length}
              onBack={() => setActiveIndex(-1)}
              onPrevious={() => void runSong(activeIndex - 1)}
              onNext={() => void runSong(activeIndex + 1)}
              onSwitchToScore={() =>
                updateSong(activeSong.id, (song) => ({
                  ...song,
                  music: song.music?.kind === "score"
                    ? { ...song.music, liveView: "score" }
                    : song.music,
                }))
              }
              onTranspose={(transpose) =>
                updateSong(activeSong.id, (song) => ({
                  ...song,
                  music: song.music?.kind === "score" && song.music.scrollGuide
                    ? {
                        ...song.music,
                        scrollGuide: { ...song.music.scrollGuide, transpose },
                      }
                    : song.music,
                }))
              }
            >
              {activeSong.voiceToneMatch?.enabled && activeSong.music.scrollGuide.key ? (
                <VoiceToneMonitor
                  key={activeSong.id}
                  targetKey={transposeKeyRoot(
                    activeSong.music.scrollGuide.key,
                    activeSong.music.scrollGuide.transpose,
                  )}
                  mode={activeSong.music.scrollGuide.mode}
                  blocked={usbStorageActive}
                />
              ) : null}
            </SetlistChartViewer>
          ) : activeSong?.music?.kind === "score" ? (
            <AlphaTabScoreViewer
              setlistName={selected.name}
              song={activeSong as SetlistSong & { music: SetlistScoreGuide }}
              index={activeIndex}
              count={selected.songs.length}
              onBack={() => setActiveIndex(-1)}
              onPrevious={() => void runSong(activeIndex - 1)}
              onNext={() => void runSong(activeIndex + 1)}
              onGuideChange={(music) =>
                updateSong(activeSong.id, (song) => ({ ...song, music }))
              }
              onSwitchToChart={activeSong.music.scrollGuide
                ? () => updateSong(activeSong.id, (song) => ({
                    ...song,
                    music: song.music?.kind === "score"
                      ? { ...song.music, liveView: "scroll" }
                      : song.music,
                  }))
                : undefined}
              onCurrentChord={setLiveChord}
              onVoiceTarget={setVoiceTarget}
              midiLive={midiLive}
              onDrumNotes={onPlayNotes}
              onSilenceDrums={onSilenceDrums}
              onRequestMidi={onRequestMidi}
            >
              {activeSong.voiceToneMatch?.enabled && activeSong.music.key ? (
                <VoiceToneMonitor
                  key={activeSong.id}
                  targetKey={transposeKeyRoot(activeSong.music.key, activeSong.music.transpose)}
                  mode={activeSong.music.mode}
                  blocked={usbStorageActive}
                  currentChord={liveChord}
                  targetNote={voiceTarget}
                />
              ) : null}
            </AlphaTabScoreViewer>
          ) : activeSong?.music?.kind === "scroll" ? (
            <SetlistChartViewer
              setlistName={selected.name}
              song={activeSong as SetlistSong & { music: SetlistScrollGuide }}
              index={activeIndex}
              count={selected.songs.length}
              onBack={() => setActiveIndex(-1)}
              onPrevious={() => void runSong(activeIndex - 1)}
              onNext={() => void runSong(activeIndex + 1)}
              onTranspose={(transpose) =>
                updateSong(activeSong.id, (song) => ({
                  ...song,
                  music: song.music ? { ...song.music, transpose } : song.music,
                }))
              }
            >
              {activeSong.voiceToneMatch?.enabled && activeSong.music.key ? (
                <VoiceToneMonitor
                  key={activeSong.id}
                  targetKey={transposeKeyRoot(activeSong.music.key, activeSong.music.transpose)}
                  mode={activeSong.music.mode}
                  blocked={usbStorageActive}
                />
              ) : null}
            </SetlistChartViewer>
          ) : (
          <section className="setlist-viewer" aria-label={`${selected.name} viewer`}>
            <div className="setlist-viewer-head">
              <div>
                <span className="playlist-eyebrow">Live Setlist</span>
                <h2>{selected.name}</h2>
              </div>
              <button type="button" className="btn ghost" onClick={() => {
                runTokenRef.current++;
                setViewerOpen(false);
              }}>Close view</button>
            </div>
            {selected.songs.length ? (
            <>
              <div className="setlist-song-pad-grid" role="group" aria-label="Setlist songs">
                {selected.songs.map((song, index) => (
                  <button
                    type="button"
                    key={song.id}
                    className={`setlist-song-pad${index === activeIndex ? " is-active" : ""}`}
                    onClick={() => void runSong(index)}
                  >
                    <span className="setlist-song-pad-head">
                      <span className="playlist-live-index">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{song.name}</strong>
                    </span>
                    <span className="setlist-song-memory">
                      Memory {String(song.memorySlot).padStart(2, "0")} · {memoryBySlot.get(song.memorySlot) || song.memoryName || "RC-600"}
                    </span>
                    {song.music?.key ? (
                      <span className="setlist-song-key">
                        Key {song.music.key} {song.music.mode}
                        {song.music.transpose ? ` · ${song.music.transpose > 0 ? "+" : ""}${song.music.transpose}` : ""}
                      </span>
                    ) : null}
                    <span className="setlist-song-summary">
                      <span><b>Before</b>{briefActions(song.beforeChange)}</span>
                      <span><b>After</b>{briefActions(song.afterChange)}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="playlist-live-nav">
                <button type="button" className="btn ghost" onClick={() => void runSong(activeIndex < 0 ? selected.songs.length - 1 : activeIndex - 1)}>Previous</button>
                <span>{activeIndex < 0 ? "Ready" : `${activeIndex + 1} / ${selected.songs.length}`}</span>
                <button type="button" className="btn primary" onClick={() => void runSong(activeIndex < 0 ? 0 : activeIndex + 1)}>Next</button>
              </div>
            </>
            ) : <p className="playlist-empty">This setlist has no songs.</p>}
          </section>
          )
        ) : null}
        {status ? <p className="playlist-status" role="status">{status}</p> : null}

        {editorOpen && selected ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setEditorOpen(false)}>
            <div
              className="modal-sheet playlist-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="setlist-editor-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="playlist-modal-head">
                <div>
                  <h2 id="setlist-editor-title">Edit setlist</h2>
                  <p>Arrange songs and the MIDI CC actions sent around each memory change.</p>
                </div>
                <button type="button" className="btn ghost" aria-label="Close" onClick={() => setEditorOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <div className="playlist-editor setlist-single-editor">
                <label className="playlist-field">
                  <span>Setlist name</span>
                  <input
                    value={selected.name}
                    onChange={(event) => updateSelected((setlist) => ({ ...setlist, name: event.target.value.slice(0, 48) }))}
                    onBlur={() => updateSelected((setlist) => ({ ...setlist, name: normalizeSetlistName(setlist.name) }))}
                  />
                </label>
                <div className="playlist-add-row">
                  <label className="playlist-field">
                    <span>Song name</span>
                    <input value={songName} placeholder="Song name" onChange={(event) => setSongName(event.target.value)} />
                  </label>
                  <label className="playlist-field memory">
                    <span>RC-600 memory</span>
                    <select value={songMemory} onChange={(event) => setSongMemory(Number(event.target.value))}>
                      {Array.from({ length: 99 }, (_, index) => index + 1).map((slot) => (
                        <option key={slot} value={slot}>{String(slot).padStart(2, "0")} {memoryBySlot.get(slot) ?? ""}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn" onClick={addSong}>Add song</button>
                </div>
                <div className="playlist-edit-list">
                  {selected.songs.map((song, index) => (
                    <div className="setlist-song-editor" key={song.id}>
                      <div className="playlist-edit-item">
                        <span className="playlist-live-index">{String(index + 1).padStart(2, "0")}</span>
                        <input aria-label={`Song ${index + 1} name`} value={song.name} onChange={(event) => updateSong(song.id, (current) => ({ ...current, name: event.target.value.slice(0, 80) }))} />
                        <select
                          aria-label={`Memory for ${song.name}`}
                          value={song.memorySlot}
                          onChange={(event) => {
                            const memorySlot = Number(event.target.value);
                            updateSong(song.id, (current) => ({ ...current, memorySlot, memoryName: memoryBySlot.get(memorySlot) ?? "" }));
                          }}
                        >
                          {Array.from({ length: 99 }, (_, slot) => slot + 1).map((slot) => (
                            <option key={slot} value={slot}>{String(slot).padStart(2, "0")} {memoryBySlot.get(slot) ?? ""}</option>
                          ))}
                        </select>
                        <div className="playlist-reorder">
                          <button
                            type="button"
                            className="btn ghost"
                            aria-expanded={expandedSongIds.has(song.id)}
                            aria-label={`${expandedSongIds.has(song.id) ? "Collapse" : "Expand"} ${song.name}`}
                            onClick={() =>
                              setExpandedSongIds((current) => {
                                const next = new Set(current);
                                if (next.has(song.id)) next.delete(song.id);
                                else next.add(song.id);
                                return next;
                              })
                            }
                          >
                            <Icon name={expandedSongIds.has(song.id) ? "chevronDown" : "chevronRight"} />
                          </button>
                          <button type="button" className="btn ghost" aria-label={`Move ${song.name} up`} disabled={index === 0} onClick={() => updateSelected((setlist) => ({ ...setlist, songs: reorderSetlistSong(setlist.songs, song.id, -1) }))}>↑</button>
                          <button type="button" className="btn ghost" aria-label={`Move ${song.name} down`} disabled={index === selected.songs.length - 1} onClick={() => updateSelected((setlist) => ({ ...setlist, songs: reorderSetlistSong(setlist.songs, song.id, 1) }))}>↓</button>
                          <button type="button" className="btn ghost danger" aria-label={`Remove ${song.name}`} onClick={() => updateSelected((setlist) => ({ ...setlist, songs: setlist.songs.filter((candidate) => candidate.id !== song.id) }))}><Icon name="deleteOutline" /></button>
                        </div>
                      </div>
                      {expandedSongIds.has(song.id) ? (
                        <>
                          <SetlistSongMusicEditor
                            song={song}
                            onChange={(nextSong) =>
                              updateSong(song.id, () => nextSong)
                            }
                          />
                          <div className="setlist-automation">
                            <MidiActionList title="Before memory change" actions={song.beforeChange} onAdd={() => addAction(song.id, "beforeChange")} onChange={(actionId, patch) => updateAction(song.id, "beforeChange", actionId, patch)} onMove={(actionId, direction) => moveAction(song.id, "beforeChange", actionId, direction)} onRemove={(actionId) => updateSong(song.id, (current) => ({ ...current, beforeChange: current.beforeChange.filter((action) => action.id !== actionId) }))} />
                            <MidiActionList title="After memory change" actions={song.afterChange} onAdd={() => addAction(song.id, "afterChange")} onChange={(actionId, patch) => updateAction(song.id, "afterChange", actionId, patch)} onMove={(actionId, direction) => moveAction(song.id, "afterChange", actionId, direction)} onRemove={(actionId) => updateSong(song.id, (current) => ({ ...current, afterChange: current.afterChange.filter((action) => action.id !== actionId) }))} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  ))}
                  {!selected.songs.length ? <p className="playlist-empty">No songs yet.</p> : null}
                </div>
                <button type="button" className="btn danger playlist-delete" onClick={() => setDeleteOpen(true)}>
                  <Icon name="deleteOutline" /> Delete setlist
                </button>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn ghost" onClick={() => openViewer(selected.id)}>
                  <Icon name="view" /> View
                </button>
                <button type="button" className="btn primary" onClick={() => setEditorOpen(false)}>Done</button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteOpen && selected ? (
          <div className="modal-backdrop playlist-confirm-layer" role="presentation" onClick={() => setDeleteOpen(false)}>
            <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-setlist-title" onClick={(event) => event.stopPropagation()}>
              <h2 id="delete-setlist-title">Delete setlist?</h2>
              <p>{selected.name} and all its song automation will be removed.</p>
              <div className="modal-foot">
                <button type="button" className="btn ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
                <button type="button" className="btn danger" onClick={deleteSetlist}>Delete setlist</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MidiActionList({
  title,
  actions,
  onAdd,
  onChange,
  onMove,
  onRemove,
}: {
  title: string;
  actions: readonly SetlistMidiAction[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<SetlistMidiAction>) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="setlist-action-list">
      <div className="setlist-action-head">
        <strong>{title}</strong>
        <button type="button" className="btn ghost" onClick={onAdd}>Add CC</button>
      </div>
      {actions.map((action, index) => (
        <div className="setlist-action-row" key={action.id}>
          <span>{index + 1}</span>
          <label>Channel<input type="number" min={1} max={16} value={action.channel} onChange={(event) => onChange(action.id, { channel: Math.max(1, Math.min(16, Number(event.target.value))) })} /></label>
          <label>CC<input type="number" min={0} max={127} value={action.controller} onChange={(event) => onChange(action.id, { controller: Math.max(0, Math.min(127, Number(event.target.value))) })} /></label>
          <label>Value<input type="number" min={0} max={127} value={action.value} onChange={(event) => onChange(action.id, { value: Math.max(0, Math.min(127, Number(event.target.value))) })} /></label>
          <label>Delay after (ms)<input type="number" min={0} max={10000} step={10} value={action.delayMs} onChange={(event) => onChange(action.id, { delayMs: Math.max(0, Math.min(10000, Number(event.target.value))) })} /></label>
          <div className="setlist-action-order">
            <button type="button" className="btn ghost" disabled={index === 0} aria-label={`Move CC action ${index + 1} up`} onClick={() => onMove(action.id, -1)}>↑</button>
            <button type="button" className="btn ghost" disabled={index === actions.length - 1} aria-label={`Move CC action ${index + 1} down`} onClick={() => onMove(action.id, 1)}>↓</button>
          </div>
          <button type="button" className="btn ghost danger" aria-label={`Remove CC action ${index + 1}`} onClick={() => onRemove(action.id)}><Icon name="deleteOutline" /></button>
        </div>
      ))}
      {!actions.length ? <small>No CC actions.</small> : null}
    </div>
  );
}
