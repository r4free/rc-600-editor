import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ASSIGN_PARAMS,
  PLAY_PARAMS,
  REC_PARAMS,
  RHYTHM_PARAMS,
  TRACK_PARAMS,
  SYSTEM_SECTIONS,
} from "@rc600/catalog/params";
import {
  type MemoryModel,
  type MemorySummary,
  type SystemModel,
  type TagMap,
  parseMemory,
  parseSystem,
  patchAssign,
  patchMemSection,
  patchMemoryName,
  patchTrack,
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
import { ParamControl, TagMapEditor } from "./components/ParamControl";
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

type TabId =
  | "name"
  | "tracks"
  | "rec"
  | "play"
  | "rhythm"
  | "assigns"
  | "ctl"
  | "fx"
  | "system"
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
  const [tab, setTab] = useState<TabId>("tracks");
  const [trackNo, setTrackNo] = useState(1);
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

  const systemModel: SystemModel | null = useMemo(() => {
    if (!sysXml) return null;
    return parseSystem(sysXml, sysSide);
  }, [sysXml, sysSide]);

  const loadSlot = useCallback(
    (s: number, map: Map<string, string> = files) => {
      const a = map.get(slotFileName(s, "A"));
      const b = map.get(slotFileName(s, "B"));
      if (!a && !b) {
        setError(`Memória ${s} não encontrada`);
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

  const loadSystem = useCallback(
    (side: "1" | "2", map: Map<string, string> = files) => {
      const raw = map.get(systemFileName(side));
      if (!raw) return;
      setSysSide(side);
      setSysXml(raw);
      setSysDirty(false);
    },
    [files],
  );

  function markXml(next: string) {
    setXml(next);
    setDirty(true);
  }

  async function openDirectory() {
    setError(null);
    try {
      const result = await pickRolandDirectory();
      if (!result) {
        setError("File System Access API indisponível — use Abrir arquivos ou ZIP.");
        return;
      }
      dirHandleRef.current = result.handle;
      setFiles(result.files.files);
      setRootLabel(result.files.rootLabel);
      setBackupAck(false);
      setStatus(`${result.files.files.size} arquivos · ${result.files.rootLabel}`);
      const first = listMemorySlots(result.files.files)[0];
      if (first) loadSlot(first, result.files.files);
      if (hasSystem(result.files.files)) loadSystem("1", result.files.files);
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
    setStatus(`${rolled.files.size} arquivos`);
    const first = listMemorySlots(rolled.files)[0];
    if (first) loadSlot(first, rolled.files);
    if (hasSystem(rolled.files)) loadSystem("1", rolled.files);
  }

  async function openZip(file: File | null) {
    if (!file) return;
    dirHandleRef.current = null;
    const rolled = await filesFromZip(await file.arrayBuffer());
    setFiles(rolled.files);
    setRootLabel(rolled.rootLabel);
    setBackupAck(false);
    setStatus(`${rolled.files.size} arquivos (ZIP)`);
    const first = listMemorySlots(rolled.files)[0];
    if (first) loadSlot(first, rolled.files);
    if (hasSystem(rolled.files)) loadSystem("1", rolled.files);
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
          if (!res.ok) throw new Error(`Falha ao carregar ${name}`);
          map.set(`DATA/${name}`, await res.text());
        }),
      );
      setFiles(map);
      setRootLabel("fixtures (demo)");
      setBackupAck(false);
      setStatus(`${map.size} arquivos demo`);
      loadSlot(1, map);
      loadSystem("1", map);
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveCurrent() {
    if (!slot || !xml) return;
    if (!backupAck) {
      setError("Confirme o backup antes de gravar no looper.");
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
        setStatus(`Salvo ${path}`);
      } catch (e) {
        setError(`Pasta aberta, mas falhou write: ${e}. Baixe o ZIP.`);
      }
    } else {
      setStatus(`Atualizado em memória: ${path} — baixe ZIP para gravar`);
    }
  }

  async function saveSystem() {
    if (!sysXml) return;
    if (!backupAck) {
      setError("Confirme o backup antes de gravar.");
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
      setStatus(`Salvo ${path}`);
    } else {
      setStatus(`System atualizado — baixe ZIP`);
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
    setStatus(`Copiado (${copyMode}) para ${copyTargets.size} slots`);
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
    { id: "name", label: "NAME" },
    { id: "tracks", label: "TRACK" },
    { id: "rec", label: "REC" },
    { id: "play", label: "PLAY" },
    { id: "rhythm", label: "RHYTHM" },
    { id: "assigns", label: "ASSIGN" },
    { id: "ctl", label: "CTL" },
    { id: "fx", label: "FX" },
    { id: "system", label: "SYSTEM" },
    { id: "copy", label: "COPY" },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-name">RC-600 Editor</div>
          <div className="brand-sub">memórias · system · Web MIDI</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn primary" onClick={openDirectory}>
            Abrir pasta
          </button>
          <button type="button" className="btn" onClick={loadDemoFixtures}>
            Demo fixtures
          </button>
          <label className="btn">
            Arquivos
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
            ZIP
            <input
              type="file"
              accept=".zip"
              style={{ display: "none" }}
              onChange={(e) => openZip(e.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className="btn" disabled={!files.size} onClick={downloadZip}>
            Baixar ZIP
          </button>
          <button
            type="button"
            className="btn warn"
            disabled={!dirty || !slot}
            onClick={saveCurrent}
          >
            Salvar memória
          </button>
          <span className={`status-pill ${dirty || sysDirty ? "dirty" : ""}`}>
            {rootLabel ?? "sem pasta"}
            {dirty || sysDirty ? " · dirty" : ""}
            {status ? ` · ${status}` : ""}
          </span>
        </div>
      </header>

      {!backupAck && files.size > 0 && (
        <div className="warn-banner">
          <p>
            Faça backup da pasta ROLAND antes de gravar no looper. O editor faz patch in-place nos
            .RC0 (par A/B + count).
          </p>
          <button type="button" className="btn primary" onClick={() => setBackupAck(true)}>
            Backup feito — liberar gravação
          </button>
        </div>
      )}

      {error && (
        <div className="warn-banner" style={{ borderColor: "var(--danger)" }}>
          <p>{error}</p>
          <button type="button" className="btn ghost" onClick={() => setError(null)}>
            Fechar
          </button>
        </div>
      )}

      {files.size === 0 ? (
        <div className="empty-state editor-panel">
          <h2>Abra a pasta ROLAND</h2>
          <p>
            Coloque o RC-600 em USB Storage (MENU → USB → STORAGE ON) ou escolha um backup no
            disco. Prefira trabalhar numa <strong>cópia</strong>.
          </p>
          <p>Chrome/Edge: Abrir pasta. Firefox: ZIP ou seletor de arquivos.</p>
          <div className="row-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="btn primary" onClick={openDirectory}>
              Abrir pasta ROLAND
            </button>
            <button type="button" className="btn" onClick={loadDemoFixtures}>
              Carregar fixtures demo
            </button>
          </div>
        </div>
      ) : (
        <div className="main">
          <aside className="sidebar">
            <div className="sidebar-head">
              <span>Memórias ({slots.length})</span>
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

          <section className="editor-panel">
            <div className="tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="editor-body">
              {!model && tab !== "system" ? (
                <p className="hint">Selecione uma memória.</p>
              ) : null}

              {tab === "name" && model && (
                <>
                  <h3 className="section-title">
                    Memory {String(slot).padStart(2, "0")} · lado {activeSide.toUpperCase()} · count{" "}
                    {model.count}
                  </h3>
                  <div className="param-grid">
                    <div className="param-card">
                      <label htmlFor="mem-name">NAME (12 chars)</label>
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

              {tab === "tracks" && model && (
                <>
                  <div className="track-tabs">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`btn ${trackNo === n ? "primary" : "ghost"}`}
                        onClick={() => setTrackNo(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="param-grid">
                    {TRACK_PARAMS.map((def) => (
                      <ParamControl
                        key={def.tag}
                        id={`tr-${trackNo}-${def.tag}`}
                        def={def}
                        value={num(model.tracks[trackNo - 1], def.tag, def.default ?? 0)}
                        onChange={(v) =>
                          markXml(patchTrack(xml, trackNo, { [def.tag]: String(v) }))
                        }
                      />
                    ))}
                  </div>
                </>
              )}

              {tab === "rec" && model && (
                <div className="param-grid">
                  {REC_PARAMS.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`rec-${def.tag}`}
                      def={def}
                      value={num(model.rec, def.tag, def.default ?? 0)}
                      onChange={(v) => markXml(patchMemSection(xml, "REC", { [def.tag]: String(v) }))}
                    />
                  ))}
                </div>
              )}

              {tab === "play" && model && (
                <div className="param-grid">
                  {PLAY_PARAMS.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`play-${def.tag}`}
                      def={def}
                      value={num(model.play, def.tag, def.default ?? 0)}
                      onChange={(v) =>
                        markXml(patchMemSection(xml, "PLAY", { [def.tag]: String(v) }))
                      }
                    />
                  ))}
                </div>
              )}

              {tab === "rhythm" && model && (
                <div className="param-grid">
                  {RHYTHM_PARAMS.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`rhy-${def.tag}`}
                      def={def}
                      value={num(model.rhythm, def.tag, def.default ?? 0)}
                      onChange={(v) =>
                        markXml(patchMemSection(xml, "RHYTHM", { [def.tag]: String(v) }))
                      }
                    />
                  ))}
                </div>
              )}

              {tab === "assigns" && model && (
                <table className="assign-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {ASSIGN_PARAMS.map((p) => (
                        <th key={p.tag}>{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {model.assigns.map((asg, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        {ASSIGN_PARAMS.map((p) => (
                          <td key={p.tag}>
                            {p.kind === "bool" ? (
                              <button
                                type="button"
                                className={`btn ${num(asg, p.tag) ? "primary" : "ghost"}`}
                                onClick={() =>
                                  markXml(
                                    patchAssign(xml, i + 1, {
                                      [p.tag]: num(asg, p.tag) ? "0" : "1",
                                    }),
                                  )
                                }
                              >
                                {num(asg, p.tag) ? "ON" : "OFF"}
                              </button>
                            ) : (
                              <input
                                type="number"
                                value={num(asg, p.tag)}
                                onChange={(e) =>
                                  markXml(
                                    patchAssign(xml, i + 1, {
                                      [p.tag]: String(Number(e.target.value) || 0),
                                    }),
                                  )
                                }
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "ctl" && model && (
                <>
                  <h3 className="section-title">CTL / INPUT / OUTPUT / ROUTING / MIXER (tags brutas)</h3>
                  <p className="hint" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    Edite valores numéricos das tags A–Z. Preferência MEMORY vs SYSTEM fica no
                    SYSTEM → PREF.
                  </p>
                  {(["INPUT", "OUTPUT", "ROUTING", "MIXER"] as const).map((sec) => (
                    <div key={sec} style={{ marginBottom: "1rem" }}>
                      <h3 className="section-title">{sec}</h3>
                      <TagMapEditor
                        tags={model[sec.toLowerCase() as "input" | "output" | "routing" | "mixer"]}
                        onChange={(tag, value) =>
                          markXml(patchMemSection(xml, sec, { [tag]: value }))
                        }
                      />
                    </div>
                  ))}
                </>
              )}

              {tab === "fx" && model && (
                <>
                  <h3 className="section-title">Input FX / Track FX banks</h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    IFX active bank tag A: {model.ifxSetup.A ?? "—"} · TFX: {model.tfxSetup.A ?? "—"}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    Os blocos FX (AA_REVERB, etc.) permanecem no XML; use o Moose ou uma versão
                    futura para editar tipo/params por slot. Setup de bank ativo:
                  </p>
                  <div className="param-grid">
                    <div className="param-card">
                      <label>IFX BANK</label>
                      <input
                        type="number"
                        min={0}
                        max={3}
                        value={num(model.ifxSetup, "A")}
                        onChange={(e) => {
                          const ifxStart = xml.indexOf("<ifx");
                          if (ifxStart < 0) return;
                          markXml(
                            patchSectionTags(xml, "SETUP", { A: String(Number(e.target.value) || 0) }, ifxStart),
                          );
                        }}
                      />
                    </div>
                    <div className="param-card">
                      <label>TFX BANK</label>
                      <input
                        type="number"
                        min={0}
                        max={3}
                        value={num(model.tfxSetup, "A")}
                        onChange={(e) => {
                          const tfxStart = xml.indexOf("<tfx");
                          if (tfxStart < 0) return;
                          markXml(
                            patchSectionTags(xml, "SETUP", { A: String(Number(e.target.value) || 0) }, tfxStart),
                          );
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {tab === "system" && (
                <>
                  <div className="row-actions">
                    <button
                      type="button"
                      className={`btn ${sysSide === "1" ? "primary" : "ghost"}`}
                      onClick={() => loadSystem("1")}
                    >
                      SYSTEM1
                    </button>
                    <button
                      type="button"
                      className={`btn ${sysSide === "2" ? "primary" : "ghost"}`}
                      onClick={() => loadSystem("2")}
                    >
                      SYSTEM2
                    </button>
                    <button
                      type="button"
                      className="btn warn"
                      disabled={!sysDirty}
                      onClick={saveSystem}
                    >
                      Salvar system
                    </button>
                    <span className="status-pill">count {systemModel?.count ?? "—"}</span>
                  </div>
                  {!systemModel ? (
                    <p>SYSTEM1/2.RC0 não encontrados nesta pasta.</p>
                  ) : (
                    SYSTEM_SECTIONS.map((sec) => {
                      const tags = systemModel.sections[sec];
                      if (!tags) return null;
                      return (
                        <div key={sec} style={{ marginBottom: "1rem" }}>
                          <h3 className="section-title">{sec}</h3>
                          <TagMapEditor
                            tags={tags}
                            onChange={(tag, value) => {
                              const next = patchSectionTags(sysXml, sec, { [tag]: value });
                              setSysXml(next);
                              setSysDirty(true);
                            }}
                          />
                        </div>
                      );
                    })
                  )}
                  {systemModel &&
                    Object.keys(systemModel.sections)
                      .filter((k) => k.startsWith("EQ_"))
                      .map((sec) => (
                        <div key={sec} style={{ marginBottom: "1rem" }}>
                          <h3 className="section-title">{sec}</h3>
                          <TagMapEditor
                            tags={systemModel.sections[sec]}
                            onChange={(tag, value) => {
                              const next = patchSectionTags(sysXml, sec, { [tag]: value });
                              setSysXml(next);
                              setSysDirty(true);
                            }}
                          />
                        </div>
                      ))}
                </>
              )}

              {tab === "copy" && model && (
                <div className="copy-panel">
                  <h3 className="section-title">Copiar da memória {slot}</h3>
                  <div className="row-actions">
                    <button
                      type="button"
                      className={`btn ${copyMode === "assigns" ? "primary" : "ghost"}`}
                      onClick={() => setCopyMode("assigns")}
                    >
                      Só ASSIGN
                    </button>
                    <button
                      type="button"
                      className={`btn ${copyMode === "all" ? "primary" : "ghost"}`}
                      onClick={() => setCopyMode("all")}
                    >
                      Memória inteira
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
                    Aplicar cópia
                  </button>
                </div>
              )}
            </div>
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
