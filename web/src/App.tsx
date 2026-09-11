import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type MemoryModel,
  type MemorySummary,
  type TagMap,
  parseMemory,
  patchAssign,
  patchMemoryName,
  pickActiveSystem,
  pickActiveXml,
  prepareSaveXml,
  summarizePair,
  patchSectionTags,
} from "@rc600/rc0/memory";
import {
  type DirectoryHandleLike,
  filesFromFileList,
  filesFromZip,
  hasSystem,
  listMemorySlots,
  pickRolandDirectory,
  slotFileName,
  systemFileName,
  writeFileToDirectory,
  zipRoland,
} from "@rc600/files/roland";
import { MidiBar } from "./components/MidiBar";
import { LoopTab } from "./components/LoopTab";
import { ControlTab } from "./components/ControlTab";
import { AssignTab } from "./components/AssignTab";
import { InputTab } from "./components/InputTab";
import { OutputTab } from "./components/OutputTab";
import { MixerTab } from "./components/MixerTab";
import { InputFxTab } from "./components/InputFxTab";
import { SystemTab } from "./components/SystemTab";
import { Icon } from "./components/Icon";
import {
  Rc600Midi,
  midiEnvironment,
  isLikelyRc600,
  loadMidiPrefs,
  queryMidiPermission,
  saveMidiPrefs,
  shouldReuseMidiAccess,
  type MidiPortInfo,
} from "@rc600/midi/rc600-midi";

type Workspace = "memory" | "system";

type TabId =
  | "info"
  | "loop"
  | "ctl"
  | "assigns"
  | "input"
  | "output"
  | "mixer"
  | "ifx"
  | "tfx"
  | "copy";

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function App() {
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [rootLabel, setRootLabel] = useState<string | null>(null);
  const dirHandleRef = useRef<DirectoryHandleLike | null>(null);
  const [backupAck, setBackupAck] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState<"a" | "b">("a");
  const [xml, setXml] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<TabId>("loop");
  const [workspace, setWorkspace] = useState<Workspace>("memory");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const midiRef = useRef(new Rc600Midi());
  const env = useMemo(() => midiEnvironment(), []);
  const midiPrefs = useMemo(() => loadMidiPrefs(), []);
  const [midiAccess, setMidiAccess] = useState(false);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [outId, setOutId] = useState<string | null>(midiPrefs.outId);
  const [connected, setConnected] = useState<string | null>(null);
  const [midiCh, setMidiCh] = useState(midiPrefs.channel);
  const [midiBusy, setMidiBusy] = useState(() => env.supported && midiPrefs.allowed);

  const [sysSide, setSysSide] = useState<"1" | "2">("1");
  const [sysXml, setSysXml] = useState("");
  const [sysDirty, setSysDirty] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set());
  const [copyMode, setCopyMode] = useState<"all" | "assigns">("assigns");

  const slots = useMemo(() => listMemorySlots(files), [files]);
  const summaries: MemorySummary[] = useMemo(() => {
    return slots.map((s) => {
      const a = files.get(slotFileName(s, "A")) ?? "";
      const b = files.get(slotFileName(s, "B")) ?? "";
      if (a && b) return summarizePair(s, a, b);
      const only = a || b;
      const m = parseMemory(only, s);
      return {
        slot: s,
        name: m.name,
        countA: a ? m.count : "0000",
        countB: b ? m.count : "0000",
        active: (a ? "a" : "b") as "a" | "b",
      };
    });
  }, [files, slots]);

  const model: MemoryModel | null = useMemo(() => {
    if (!xml || slot == null) return null;
    return parseMemory(xml, slot);
  }, [xml, slot]);

  const systemModel = useMemo(() => {
    if (!sysXml) return null;
    return { side: sysSide, count: sysXml.match(/<count>([^<]+)<\/count>/)?.[1] ?? "—" };
  }, [sysXml, sysSide]);

  const loadSlot = useCallback(
    (s: number, map: Map<string, string> = files) => {
      const a = map.get(slotFileName(s, "A"));
      const b = map.get(slotFileName(s, "B"));
      if (!a && !b) {
        setError(`Memory ${s} not found`);
        return;
      }
      if (a && b) {
        const picked = pickActiveXml(a, b);
        setActiveSide(picked.side);
        setXml(picked.xml);
      } else {
        setActiveSide(a ? "a" : "b");
        setXml((a || b)!);
      }
      setSlot(s);
      setDirty(false);
      setError(null);
    },
    [files],
  );

  const loadSystem = useCallback((map: Map<string, string> = files) => {
    const picked = pickActiveSystem(map.get(systemFileName("1")), map.get(systemFileName("2")));
    if (!picked) {
      setSysXml("");
      return;
    }
    setSysSide(picked.side);
    setSysXml(picked.xml);
    setSysDirty(false);
  }, [files]);

  function markXml(next: string) {
    setXml(next);
    setDirty(true);
  }

  async function openDirectory() {
    setError(null);
    try {
      const result = await pickRolandDirectory();
      if (!result) {
        setError("File System Access API is unavailable — use Files or ZIP.");
        return;
      }
      dirHandleRef.current = result.handle;
      setFiles(result.files.files);
      setRootLabel(result.files.rootLabel);
      setBackupAck(false);
      setStatus(`${result.files.files.size} files · ${result.files.rootLabel}`);
      const first = listMemorySlots(result.files.files)[0];
      if (first) loadSlot(first, result.files.files);
      if (hasSystem(result.files.files)) loadSystem(result.files.files);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(String(e));
    }
  }

  async function openFiles(list: FileList | null) {
    if (!list?.length) return;
    dirHandleRef.current = null;
    const rolled = await filesFromFileList(list);
    setFiles(rolled.files);
    setRootLabel(rolled.rootLabel);
    setBackupAck(false);
    setStatus(`${rolled.files.size} files`);
    const first = listMemorySlots(rolled.files)[0];
    if (first) loadSlot(first, rolled.files);
    if (hasSystem(rolled.files)) loadSystem(rolled.files);
  }

  async function openZip(file: File | null) {
    if (!file) return;
    dirHandleRef.current = null;
    const rolled = await filesFromZip(await file.arrayBuffer());
    setFiles(rolled.files);
    setRootLabel(rolled.rootLabel);
    setBackupAck(false);
    setStatus(`${rolled.files.size} files (ZIP)`);
    const first = listMemorySlots(rolled.files)[0];
    if (first) loadSlot(first, rolled.files);
    if (hasSystem(rolled.files)) loadSystem(rolled.files);
  }

  async function loadDemoFixtures() {
    setError(null);
    dirHandleRef.current = null;
    const names = [
      "MEMORY001A.RC0",
      "MEMORY001B.RC0",
      "MEMORY002A.RC0",
      "MEMORY002B.RC0",
      "SYSTEM1.RC0",
      "SYSTEM2.RC0",
    ];
    const map = new Map<string, string>();
    try {
      await Promise.all(
        names.map(async (name) => {
          const res = await fetch(`/fixtures/DATA/${name}`);
          if (!res.ok) throw new Error(`Failed to load ${name}`);
          map.set(`DATA/${name}`, await res.text());
        }),
      );
      setFiles(map);
      setRootLabel("fixtures (demo)");
      setBackupAck(false);
      setStatus(`${map.size} demo files`);
      loadSlot(1, map);
      loadSystem(map);
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveCurrent() {
    if (!slot || !xml) return;
    if (!backupAck) {
      setError("Confirm the backup before writing to the looper.");
      return;
    }
    const saved = prepareSaveXml(xml);
    const path = slotFileName(slot, activeSide === "a" ? "A" : "B");
    const next = new Map(files);
    next.set(path, saved);
    setFiles(next);
    setXml(saved);
    setDirty(false);

    if (dirHandleRef.current) {
      try {
        await writeFileToDirectory(dirHandleRef.current, path, saved);
        setStatus(`Saved ${path}`);
      } catch (e) {
        setError(`Folder is open, but write failed: ${e}. Download the ZIP.`);
      }
    } else {
      setStatus(`Updated in memory: ${path} — download ZIP to write`);
    }
  }

  async function saveSystem() {
    if (!sysXml) return;
    if (!backupAck) {
      setError("Confirm the backup before writing.");
      return;
    }
    const saved = prepareSaveXml(sysXml);
    const path = systemFileName(sysSide);
    const next = new Map(files);
    next.set(path, saved);
    setFiles(next);
    setSysXml(saved);
    setSysDirty(false);
    if (dirHandleRef.current) {
      await writeFileToDirectory(dirHandleRef.current, path, saved);
      setStatus(`Saved ${path}`);
    } else {
      setStatus(`System updated — download ZIP`);
    }
  }

  function downloadZip() {
    const zipped = zipRoland(files);
    const blob = new Blob([zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer], {
      type: "application/zip",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ROLAND-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function applyCopy() {
    if (!slot || !xml || copyTargets.size === 0) return;
    const next = new Map(files);
    const source = parseMemory(xml, slot);
    for (const target of copyTargets) {
      if (target === slot) continue;
      const aPath = slotFileName(target, "A");
      const bPath = slotFileName(target, "B");
      const a = next.get(aPath);
      const b = next.get(bPath);
      if (!a && !b) continue;
      const picked = a && b ? pickActiveXml(a, b) : { side: (a ? "a" : "b") as "a" | "b", xml: (a || b)! };
      let patched = picked.xml;
      if (copyMode === "all") {
        patched = prepareSaveXml(xml); // full clone of current active xml into target active side
        // keep target slot identity via filename only
      } else {
        for (let i = 1; i <= 16; i++) {
          patched = patchAssign(patched, i, source.assigns[i - 1] ?? {});
        }
        patched = prepareSaveXml(patched);
      }
      const path = slotFileName(target, picked.side === "a" ? "A" : "B");
      next.set(path, patched);
    }
    setFiles(next);
    setStatus(`Copied (${copyMode}) to ${copyTargets.size} slots`);
  }

  const applyMidiPorts = useCallback(
    (ports: { outputs: MidiPortInfo[] }, autoConnect: boolean) => {
      setMidiAccess(true);
      setOutputs(ports.outputs);
      const prefs = loadMidiPrefs();
      const preferred =
        ports.outputs.find((p) => p.id === outId) ??
        ports.outputs.find((p) => p.id === prefs.outId) ??
        ports.outputs.find((p) => isLikelyRc600(p.name));
      const nextOutId = preferred?.id ?? outId;
      if (nextOutId) setOutId(nextOutId);
      saveMidiPrefs({ allowed: true, outId: nextOutId ?? prefs.outId, channel: midiCh });
      if (autoConnect && nextOutId) {
        midiRef.current.channel = midiCh;
        if (midiRef.current.connect(nextOutId)) setConnected(midiRef.current.connectedName);
      }
    },
    [midiCh, outId],
  );

  const requestMidi = useCallback(
    async (autoConnect = false) => {
      setMidiBusy(true);
      try {
        const ports = await midiRef.current.requestAccess();
        applyMidiPorts(ports, autoConnect);
      } catch (e) {
        saveMidiPrefs({ allowed: false });
        setMidiAccess(false);
        setError(String(e));
      } finally {
        setMidiBusy(false);
      }
    },
    [applyMidiPorts],
  );

  function refreshMidi() {
    const ports = midiRef.current.listPorts();
    applyMidiPorts(ports, Boolean(connected));
  }

  function connectMidi() {
    if (!outId) return;
    midiRef.current.channel = midiCh;
    if (midiRef.current.connect(outId)) {
      setConnected(midiRef.current.connectedName);
      saveMidiPrefs({ allowed: true, outId, channel: midiCh });
    }
  }

  const applyMidiPortsRef = useRef(applyMidiPorts);
  applyMidiPortsRef.current = applyMidiPorts;
  const requestMidiRef = useRef(requestMidi);
  requestMidiRef.current = requestMidi;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  useEffect(() => {
    midiRef.current.channel = midiCh;
    saveMidiPrefs({ channel: midiCh });
  }, [midiCh]);

  useEffect(() => {
    const midi = midiRef.current;
    midi.onStateChange = (ports) => {
      applyMidiPortsRef.current(ports, !connectedRef.current);
    };
    return () => {
      midi.onStateChange = null;
    };
  }, []);

  useEffect(() => {
    if (!env.supported) return;
    let cancelled = false;
    let status: PermissionStatus | undefined;
    const onPermissionChange = () => {
      if (status?.state === "granted") void requestMidiRef.current(true);
    };

    async function restoreMidi() {
      const permission = await queryMidiPermission();
      if (cancelled) return;
      if (!shouldReuseMidiAccess(permission, loadMidiPrefs().allowed)) {
        setMidiBusy(false);
        return;
      }
      await requestMidiRef.current(true);
    }

    void restoreMidi();

    void (async () => {
      try {
        status = await navigator.permissions.query({
          name: "midi",
          sysex: false,
        } as PermissionDescriptor);
        if (cancelled) return;
        status.addEventListener("change", onPermissionChange);
      } catch {
        /* Permissions API for MIDI is optional */
      }
    })();

    return () => {
      cancelled = true;
      status?.removeEventListener("change", onPermissionChange);
    };
  }, [env.supported]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "info", label: "Info" },
    { id: "loop", label: "Loop" },
    { id: "ctl", label: "Ctl Func" },
    { id: "assigns", label: "Assigns" },
    { id: "input", label: "Input" },
    { id: "output", label: "Output" },
    { id: "mixer", label: "Mixer" },
    { id: "ifx", label: "Input FX" },
    { id: "tfx", label: "Track FX" },
    { id: "copy", label: "Copy" },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-name">RC-600 Editor</div>
          <div className="brand-sub">memories · system · Web MIDI</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn primary" onClick={openDirectory}>
            <Icon name="folderOpen" size={14} />
            Open folder
          </button>
          <button type="button" className="btn" onClick={loadDemoFixtures}>
            Demo fixtures
          </button>
          <label className="btn">
            <Icon name="folderOpen" size={14} />
            Files
            <input
              type="file"
              multiple
              // @ts-expect-error webkitdirectory
              webkitdirectory=""
              style={{ display: "none" }}
              onChange={(e) => openFiles(e.target.files)}
            />
          </label>
          <label className="btn">
            <Icon name="archive" size={14} />
            ZIP
            <input
              type="file"
              accept=".zip"
              style={{ display: "none" }}
              onChange={(e) => openZip(e.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className="btn" disabled={!files.size} onClick={downloadZip}>
            Download ZIP
          </button>
          <button
            type="button"
            className="btn warn"
            disabled={!dirty || !slot}
            onClick={saveCurrent}
          >
            <Icon name="save" size={14} />
            Save memory
          </button>
          <span className={`status-pill ${dirty || sysDirty ? "dirty" : ""}`}>
            {rootLabel ?? "no folder"}
            {dirty || sysDirty ? " · dirty" : ""}
            {status ? ` · ${status}` : ""}
          </span>
        </div>
      </header>

      {!backupAck && files.size > 0 && (
        <div className="warn-banner">
          <p>
            Back up the ROLAND folder before writing to the looper. Saves patch .RC0 files in place
            (A/B pair + count).
          </p>
          <button type="button" className="btn primary" onClick={() => setBackupAck(true)}>
            Backup done — unlock save
          </button>
        </div>
      )}

      {error && (
        <div className="warn-banner" style={{ borderColor: "var(--danger)" }}>
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={() => setError(null)}>
            Close
          </button>
        </div>
      )}

      {files.size === 0 ? (
        <div className="empty-state editor-panel">
          <h2>Open the ROLAND folder</h2>
          <p>
            Put the RC-600 in USB Storage (MENU → USB → STORAGE ON) or choose a backup on disk.
            Prefer working on a <strong>copy</strong>.
          </p>
          <p>Chrome/Edge: Open folder. Firefox: ZIP or file picker.</p>
          <div className="row-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="btn primary" onClick={openDirectory}>
              <Icon name="folderOpen" size={14} />
              Open ROLAND folder
            </button>
            <button type="button" className="btn" onClick={loadDemoFixtures}>
              Load demo fixtures
            </button>
          </div>
        </div>
      ) : (
        <div className="main">
          <section className="editor-panel">
            <div className="tabs tabs-workspace" role="tablist" aria-label="Workspace">
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "memory"}
                className={`tab ${workspace === "memory" ? "active" : ""}`}
                onClick={() => setWorkspace("memory")}
              >
                <Icon name="library" size={14} />
                Memory
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "system"}
                className={`tab ${workspace === "system" ? "active" : ""}`}
                onClick={() => {
                  setWorkspace("system");
                  if (!sysXml) loadSystem();
                }}
              >
                <Icon name="system" size={14} />
                System
              </button>
              {workspace === "system" ? (
                <>
                  <span className="status-pill" style={{ marginLeft: "auto" }}>
                    SYSTEM{sysSide} · count {systemModel?.count ?? "—"}
                  </span>
                  <button
                    type="button"
                    className="btn warn"
                    disabled={!sysDirty}
                    onClick={saveSystem}
                  >
                    <Icon name="save" size={14} />
                    Save system
                  </button>
                </>
              ) : null}
            </div>

            {workspace === "memory" ? (
              <div className="memory-layout">
                <aside className="sidebar">
                  <div className="sidebar-head">
                    <span>Memories ({slots.length})</span>
                  </div>
                  <div className="mem-list">
                    {summaries.map((s) => (
                      <button
                        key={s.slot}
                        type="button"
                        className={`mem-item ${slot === s.slot ? "active" : ""}`}
                        onClick={() => loadSlot(s.slot)}
                      >
                        <span className="slot">{String(s.slot).padStart(2, "0")}</span>
                        <span className="name">{s.name || "—"}</span>
                        <span className="meta">{s.active.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="memory-editor">
                  <div className="tabs" role="tablist" aria-label="Memory editor">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        className={`tab ${tab === t.id ? "active" : ""}`}
                        onClick={() => setTab(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="editor-body">
                    {!model ? <p className="hint">Select a memory.</p> : null}

                    {tab === "info" && model && (
                      <>
                        <h3 className="section-title">
                          Memory {String(slot).padStart(2, "0")} · side {activeSide.toUpperCase()} ·
                          count {model.count}
                        </h3>
                        <div className="param-row">
                          <div className="param-label">
                            <label htmlFor="mem-name">Name</label>
                          </div>
                          <div className="param-control">
                            <input
                              id="mem-name"
                              type="text"
                              maxLength={12}
                              value={model.name}
                              onChange={(e) => markXml(patchMemoryName(xml, e.target.value))}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {tab === "loop" && model ? (
                      <LoopTab model={model} xml={xml} onXml={markXml} />
                    ) : null}

                    {tab === "assigns" && model ? (
                      <AssignTab model={model} xml={xml} onXml={markXml} />
                    ) : null}

                    {tab === "ctl" && model ? (
                      <ControlTab model={model} xml={xml} onXml={markXml} />
                    ) : null}

                    {tab === "input" && model ? (
                      <InputTab model={model} xml={xml} onXml={markXml} />
                    ) : null}

                    {tab === "output" && model ? (
                      <OutputTab model={model} xml={xml} onXml={markXml} />
                    ) : null}

                    {tab === "mixer" && model ? (
                      <MixerTab model={model} xml={xml} onXml={markXml} />
                    ) : null}

                    {tab === "ifx" && model ? (
                      <InputFxTab model={model} xml={xml} onXml={markXml} />
                    ) : null}

                    {tab === "tfx" && model ? (
                      <>
                        <h3 className="section-title">Track FX</h3>
                        <p className="hint">
                          FX blocks stay in the XML. Bank select is below; per-slot type/params come
                          in a later pass.
                        </p>
                        <div className="param-row">
                          <div className="param-label">
                            <label htmlFor="fx-bank">TFX bank</label>
                          </div>
                          <div className="param-control">
                            <input
                              id="fx-bank"
                              type="number"
                              min={0}
                              max={3}
                              value={num(model.tfxSetup, "A")}
                              onChange={(e) => {
                                const start = xml.indexOf("<tfx");
                                if (start < 0) return;
                                markXml(
                                  patchSectionTags(
                                    xml,
                                    "SETUP",
                                    { A: String(Number(e.target.value) || 0) },
                                    start,
                                  ),
                                );
                              }}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    {tab === "copy" && model && (
                      <div className="copy-panel">
                        <h3 className="section-title">Copy from memory {slot}</h3>
                        <div className="row-actions">
                          <button
                            type="button"
                            className={`btn ${copyMode === "assigns" ? "primary" : "ghost"}`}
                            onClick={() => setCopyMode("assigns")}
                          >
                            Assigns only
                          </button>
                          <button
                            type="button"
                            className={`btn ${copyMode === "all" ? "primary" : "ghost"}`}
                            onClick={() => setCopyMode("all")}
                          >
                            Entire memory
                          </button>
                        </div>
                        <div className="targets">
                          {slots.map((s) => (
                            <label key={s}>
                              <input
                                type="checkbox"
                                checked={copyTargets.has(s)}
                                disabled={s === slot}
                                onChange={(e) => {
                                  const next = new Set(copyTargets);
                                  if (e.target.checked) next.add(s);
                                  else next.delete(s);
                                  setCopyTargets(next);
                                }}
                              />
                              {String(s).padStart(2, "0")}
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={!copyTargets.size || !backupAck}
                          onClick={applyCopy}
                        >
                          Apply copy
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="editor-body">
                {!sysXml ? (
                  <p>SYSTEM1/2.RC0 not found in this folder.</p>
                ) : (
                  <SystemTab
                    xml={sysXml}
                    side={sysSide}
                    onXml={(next) => {
                      setSysXml(next);
                      setSysDirty(true);
                    }}
                  />
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <MidiBar
        env={env}
        outputs={outputs}
        selectedOutId={outId}
        connectedName={connected}
        busy={midiBusy}
        hasAccess={midiAccess}
        onRequestAccess={() => void requestMidi(true)}
        onSelectOut={(id) => {
          setOutId(id);
          saveMidiPrefs({ outId: id || null });
        }}
        onConnect={connectMidi}
        onDisconnect={() => {
          midiRef.current.disconnect();
          setConnected(null);
        }}
        onRefresh={refreshMidi}
        channel={midiCh}
        onChannel={setMidiCh}
        currentSlot={slot}
        onProgram={(s) => midiRef.current.programChange(s)}
        onStart={() => midiRef.current.start()}
        onStop={() => midiRef.current.stop()}
        onCc={(cc, v) => midiRef.current.controlChange(cc, v)}
      />
    </div>
  );
}
