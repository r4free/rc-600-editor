import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type MemoryModel,
  type MemorySummary,
  type TagMap,
  parseMemory,
  pickActiveSystem,
  pickActiveXml,
  summarizePair,
} from "@rc600/rc0/memory";
import { applyOpsToModel, normalizeOps, type PatchOp } from "@rc600/rc0/ops";
import {
  type DirectoryHandleLike,
  filesFromDirectoryHandle,
  filesFromFileList,
  filesFromZip,
  hasSystem,
  listMemorySlots,
  pickRolandDirectory,
  queryDirectoryPermission,
  requestDirectoryPermission,
  slotFileName,
  systemFileName,
  writeFileToDirectory,
  zipRoland,
} from "@rc600/files/roland";
import {
  assembleRemote,
  ejectUsbStorage,
  fetchSession,
  fetchUsbStatus,
  lockSession,
  type SessionInfo,
} from "./api";
import { MidiBar } from "./components/MidiBar";
import { LoopTab } from "./components/LoopTab";
import { ControlTab } from "./components/ControlTab";
import { AssignTab } from "./components/AssignTab";
import { InputTab } from "./components/InputTab";
import { OutputTab } from "./components/OutputTab";
import { MixerTab } from "./components/MixerTab";
import { InputFxTab } from "./components/InputFxTab";
import { SystemTab } from "./components/SystemTab";
import { LicenseScreen } from "./components/LicenseScreen";
import { PlatformSelect } from "./components/PlatformSelect";
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
import {
  clearFolderMeta,
  clearRolandHandle,
  loadFolderMeta,
  loadRolandHandle,
  saveFolderMeta,
  saveRolandHandle,
} from "@rc600/files/folder-store";

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

function DevNotice() {
  return (
    <div className="dev-notice" role="status">
      <Icon name="alert" size={14} />
      <p>
        <strong>Early development — not fully tested yet.</strong> This project is still in
        progress. The UI is English-only. Always back up your ROLAND folder before saving to the
        looper.
      </p>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [rootLabel, setRootLabel] = useState<string | null>(null);
  const dirHandleRef = useRef<DirectoryHandleLike | null>(null);
  const [hasDirHandle, setHasDirHandle] = useState(false);
  const [folderReady, setFolderReady] = useState(false);
  const [pendingHandle, setPendingHandle] = useState<DirectoryHandleLike | null>(null);
  const [usbEjectLocal, setUsbEjectLocal] = useState(false);
  const [ejecting, setEjecting] = useState(false);
  const [backupAck, setBackupAck] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState<"a" | "b">("a");
  const [baseXml, setBaseXml] = useState("");
  const [ops, setOps] = useState<PatchOp[]>([]);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<TabId>("loop");
  const [workspace, setWorkspace] = useState<Workspace>("memory");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
  const [sysBaseXml, setSysBaseXml] = useState("");
  const [sysOps, setSysOps] = useState<PatchOp[]>([]);
  const [sysDirty, setSysDirty] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set());
  const [copyMode, setCopyMode] = useState<"all" | "assigns">("assigns");

  useEffect(() => {
    let cancelled = false;
    void fetchSession().then((info) => {
      if (!cancelled) setSession(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchUsbStatus().then((info) => {
      if (!cancelled) setUsbEjectLocal(info.eject);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sessionOk = session?.ok === true;
  const requireLicense = session?.requireLicense === true;
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
    if (!baseXml || slot == null) return null;
    return applyOpsToModel(parseMemory(baseXml, slot), ops);
  }, [baseXml, slot, ops]);

  const systemModel = useMemo(() => {
    if (!sysBaseXml) return null;
    return { side: sysSide, count: sysBaseXml.match(/<count>([^<]+)<\/count>/)?.[1] ?? "—" };
  }, [sysBaseXml, sysSide]);

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
        setBaseXml(picked.xml);
      } else {
        setActiveSide(a ? "a" : "b");
        setBaseXml((a || b)!);
      }
      setSlot(s);
      setOps([]);
      setDirty(false);
      setError(null);
    },
    [files],
  );

  const loadSystem = useCallback((map: Map<string, string> = files) => {
    const picked = pickActiveSystem(map.get(systemFileName("1")), map.get(systemFileName("2")));
    if (!picked) {
      setSysBaseXml("");
      setSysOps([]);
      return;
    }
    setSysSide(picked.side);
    setSysBaseXml(picked.xml);
    setSysOps([]);
    setSysDirty(false);
  }, [files]);

  const pushOps = useCallback((next: PatchOp | PatchOp[]) => {
    setOps((prev) => [...prev, ...normalizeOps(next)]);
    setDirty(true);
  }, []);

  const pushSysOps = useCallback((next: PatchOp | PatchOp[]) => {
    setSysOps((prev) => [...prev, ...normalizeOps(next)]);
    setSysDirty(true);
  }, []);

  const applyRolandFiles = useCallback(
    (
      map: Map<string, string>,
      label: string,
      opts?: { backupAck?: boolean; preferredSlot?: number | null },
    ) => {
      setFiles(map);
      setRootLabel(label);
      setBackupAck(opts?.backupAck ?? false);
      setPendingHandle(null);
      setStatus(`${map.size} files · ${label}`);
      const slotsNow = listMemorySlots(map);
      const preferred = opts?.preferredSlot;
      const first = preferred && slotsNow.includes(preferred) ? preferred : slotsNow[0];
      if (first) loadSlot(first, map);
      if (hasSystem(map)) loadSystem(map);
    },
    [loadSlot, loadSystem],
  );
  const applyRolandFilesRef = useRef(applyRolandFiles);
  applyRolandFilesRef.current = applyRolandFiles;

  useEffect(() => {
    let cancelled = false;
    async function restoreFolder() {
      try {
        const handle = await loadRolandHandle();
        if (cancelled) return;
        if (!handle) {
          setFolderReady(true);
          return;
        }
        const perm = await queryDirectoryPermission(handle);
        if (cancelled) return;
        if (perm === "prompt") {
          setPendingHandle(handle);
          setRootLabel(loadFolderMeta().rootLabel);
          setFolderReady(true);
          return;
        }
        if (perm === "denied") {
          await clearRolandHandle();
          clearFolderMeta();
          setFolderReady(true);
          return;
        }
        try {
          const result = await filesFromDirectoryHandle(handle);
          if (cancelled) return;
          const meta = loadFolderMeta();
          dirHandleRef.current = result.handle;
          setHasDirHandle(true);
          applyRolandFilesRef.current(result.files.files, result.files.rootLabel, {
            backupAck: meta.backupAck,
            preferredSlot: meta.lastSlot,
          });
          saveFolderMeta({ rootLabel: result.files.rootLabel });
        } catch {
          if (cancelled) return;
          setPendingHandle(handle);
          setRootLabel(loadFolderMeta().rootLabel);
        }
      } catch {
        /* IndexedDB restore is best-effort */
      } finally {
        if (!cancelled) setFolderReady(true);
      }
    }
    void restoreFolder();
    return () => {
      cancelled = true;
    };
  }, []);

  async function attachDirectoryHandle(handle: DirectoryHandleLike, label: string | null) {
    dirHandleRef.current = handle;
    setHasDirHandle(true);
    try {
      await saveRolandHandle(handle);
    } catch {
      /* IndexedDB persist is best-effort */
    }
    saveFolderMeta({ rootLabel: label });
  }

  function dropLiveHandle() {
    dirHandleRef.current = null;
    setHasDirHandle(false);
  }

  async function openDirectory() {
    setError(null);
    try {
      const result = await pickRolandDirectory();
      if (!result) {
        setError("File System Access API is unavailable — use Files or ZIP.");
        return;
      }
      await attachDirectoryHandle(result.handle, result.files.rootLabel);
      saveFolderMeta({ backupAck: false });
      applyRolandFiles(result.files.files, result.files.rootLabel, { backupAck: false });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(String(e));
    }
  }

  async function openFiles(list: FileList | null) {
    if (!list?.length) return;
    dropLiveHandle();
    const rolled = await filesFromFileList(list);
    applyRolandFiles(rolled.files, rolled.rootLabel, { backupAck: false });
  }

  async function openZip(file: File | null) {
    if (!file) return;
    dropLiveHandle();
    const rolled = await filesFromZip(await file.arrayBuffer());
    applyRolandFiles(rolled.files, rolled.rootLabel, { backupAck: false });
  }

  async function loadDemoFixtures() {
    setError(null);
    dropLiveHandle();
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
      applyRolandFiles(map, "fixtures (demo)", { backupAck: false, preferredSlot: 1 });
    } catch (e) {
      setError(String(e));
    }
  }

  async function reconnectLastFolder() {
    const handle = pendingHandle;
    if (!handle) return;
    setError(null);
    const perm = await requestDirectoryPermission(handle);
    if (perm !== "granted" && perm !== "unknown") {
      setError("Folder access was not granted. Choose the ROLAND folder again.");
      return;
    }
    try {
      const result = await filesFromDirectoryHandle(handle);
      const meta = loadFolderMeta();
      await attachDirectoryHandle(result.handle, result.files.rootLabel);
      applyRolandFiles(result.files.files, result.files.rootLabel, {
        backupAck: meta.backupAck,
        preferredSlot: meta.lastSlot,
      });
    } catch (e) {
      setError(String(e));
    }
  }

  async function forgetSavedFolder() {
    setPendingHandle(null);
    dropLiveHandle();
    await clearRolandHandle();
    clearFolderMeta();
    if (files.size === 0) setRootLabel(null);
  }

  async function ejectUsb() {
    if (dirty || sysDirty) {
      setError("Save memory/system first, then eject USB so the RC-600 can power off.");
      return;
    }
    setEjecting(true);
    setError(null);
    dropLiveHandle();
    setFiles(new Map());
    setSlot(null);
    setBaseXml("");
    setOps([]);
    setSysBaseXml("");
    setSysOps([]);
    setDirty(false);
    setSysDirty(false);
    setPendingHandle(await loadRolandHandle());
    try {
      if (usbEjectLocal) {
        const result = await ejectUsbStorage();
        setStatus(result.message);
        if (!result.ok) setError(result.message);
      } else {
        setStatus(
          "Folder released. Eject BOSS RC-600 in File Explorer, wait for DISCONNECTING…, then power off.",
        );
      }
    } finally {
      setEjecting(false);
    }
  }

  async function saveCurrent() {
    if (!slot || !baseXml) return;
    if (requireLicense && !sessionOk) {
      setError("Enter a valid license key before saving.");
      return;
    }
    if (!backupAck) {
      setError("Confirm the backup before writing to the looper.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { xml: saved } = await assembleRemote({ kind: "patch", xml: baseXml, ops });
      const path = slotFileName(slot, activeSide === "a" ? "A" : "B");
      const next = new Map(files);
      next.set(path, saved);
      setFiles(next);
      setBaseXml(saved);
      setOps([]);
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
    } catch (e) {
      setError(String(e));
      if (String(e).includes("License required") || String(e).includes("expired")) {
        void fetchSession().then(setSession);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveSystem() {
    if (!sysBaseXml) return;
    if (requireLicense && !sessionOk) {
      setError("Enter a valid license key before saving.");
      return;
    }
    if (!backupAck) {
      setError("Confirm the backup before writing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { xml: saved } = await assembleRemote({
        kind: "patch",
        xml: sysBaseXml,
        ops: sysOps,
      });
      const path = systemFileName(sysSide);
      const next = new Map(files);
      next.set(path, saved);
      setFiles(next);
      setSysBaseXml(saved);
      setSysOps([]);
      setSysDirty(false);
      if (dirHandleRef.current) {
        await writeFileToDirectory(dirHandleRef.current, path, saved);
        setStatus(`Saved ${path}`);
      } else {
        setStatus(`System updated — download ZIP`);
      }
    } catch (e) {
      setError(String(e));
      if (String(e).includes("License required") || String(e).includes("expired")) {
        void fetchSession().then(setSession);
      }
    } finally {
      setSaving(false);
    }
  }

  function downloadZip() {
    if (dirty || sysDirty) {
      setError(
        "Unsaved edits are not in the ZIP yet. Save memory/system first (needs the server), then download.",
      );
      return;
    }
    const zipped = zipRoland(files);
    const blob = new Blob(
      [zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer],
      { type: "application/zip" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ROLAND-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function applyCopy() {
    if (!slot || !baseXml || copyTargets.size === 0) return;
    if (requireLicense && !sessionOk) {
      setError("Enter a valid license key before copying.");
      return;
    }
    if (!backupAck) {
      setError("Confirm the backup before writing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sourceXml = dirty
        ? (await assembleRemote({ kind: "patch", xml: baseXml, ops })).xml
        : baseXml;
      const next = new Map(files);
      const selfPath = slotFileName(slot, activeSide === "a" ? "A" : "B");
      next.set(selfPath, sourceXml);
      if (dirty) {
        setBaseXml(sourceXml);
        setOps([]);
        setDirty(false);
        if (dirHandleRef.current) {
          await writeFileToDirectory(dirHandleRef.current, selfPath, sourceXml);
        }
      }

      for (const target of copyTargets) {
        if (target === slot) continue;
        const aPath = slotFileName(target, "A");
        const bPath = slotFileName(target, "B");
        const a = next.get(aPath);
        const b = next.get(bPath);
        if (!a && !b) continue;
        const picked =
          a && b ? pickActiveXml(a, b) : { side: (a ? "a" : "b") as "a" | "b", xml: (a || b)! };
        const { xml: patched } = await assembleRemote({
          kind: "copy",
          sourceXml,
          targetXml: picked.xml,
          mode: copyMode,
        });
        const path = slotFileName(target, picked.side === "a" ? "A" : "B");
        next.set(path, patched);
        if (dirHandleRef.current) {
          await writeFileToDirectory(dirHandleRef.current, path, patched);
        }
      }
      setFiles(next);
      setStatus(`Copied (${copyMode}) to ${copyTargets.size} slots`);
    } catch (e) {
      setError(String(e));
      if (String(e).includes("License required") || String(e).includes("expired")) {
        void fetchSession().then(setSession);
      }
    } finally {
      setSaving(false);
    }
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

  useEffect(() => {
    if (!hasDirHandle || slot == null) return;
    saveFolderMeta({ lastSlot: slot });
  }, [hasDirHandle, slot]);

  useEffect(() => {
    if (!hasDirHandle) return;
    saveFolderMeta({ backupAck });
  }, [hasDirHandle, backupAck]);

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

  if (session === null) {
    return (
      <div className="app">
        <DevNotice />
        <div className="empty-state editor-panel">
          <p>Checking session…</p>
        </div>
      </div>
    );
  }

  if (requireLicense && !sessionOk) {
    return (
      <div className="app">
        <DevNotice />
        <header className="topbar">
          <div className="topbar-start">
            <div className="brand">
              <div className="brand-name">RC-600 Editor</div>
              <div className="brand-sub">memories · system · Web MIDI</div>
            </div>
            <PlatformSelect current="rc-600" />
          </div>
        </header>
        <LicenseScreen onActivated={setSession} />
      </div>
    );
  }

  return (
    <div className="app">
      <DevNotice />
      <header className="topbar">
        <div className="topbar-start">
          <div className="brand">
            <div className="brand-name">RC-600 Editor</div>
            <div className="brand-sub">memories · system · Web MIDI</div>
          </div>
          <PlatformSelect current="rc-600" />
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
          {hasDirHandle || usbEjectLocal || pendingHandle ? (
            <button
              type="button"
              className="btn"
              disabled={ejecting}
              onClick={() => void ejectUsb()}
              title="Eject USB Storage so the RC-600 can leave CONNECTING and you can power off"
            >
              <Icon name="eject" size={14} />
              {ejecting ? "Ejecting…" : "Eject USB"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn warn"
            disabled={!dirty || !slot || saving}
            onClick={() => void saveCurrent()}
          >
            <Icon name="save" size={14} />
            Save memory
          </button>
          {requireLicense ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                void lockSession().then((info) => {
                  setSession(info ?? { ok: false, mode: "license", requireLicense: true, license: null });
                });
              }}
            >
              Clear license
            </button>
          ) : null}
          <span className={`status-pill ${dirty || sysDirty ? "dirty" : ""}`}>
            {rootLabel ?? "no folder"}
            {session.license
              ? ` · license until ${session.license.expiresAt.slice(0, 10)}`
              : session.mode === "open"
                ? " · public"
                : ""}
            {dirty || sysDirty ? " · dirty" : ""}
            {status ? ` · ${status}` : ""}
          </span>
        </div>
      </header>

      {!backupAck && files.size > 0 && (
        <div className="warn-banner">
          <p>
            Back up the ROLAND folder before writing to the looper. Saves patch .RC0 files in place
            (A/B pair + count). Needs this server online.
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
          {!folderReady ? (
            <>
              <h2>Opening last folder…</h2>
              <p>Chrome/Edge can reopen the ROLAND folder you already allowed.</p>
            </>
          ) : pendingHandle ? (
            <>
              <h2>Reconnect the ROLAND folder</h2>
              <p>
                Last folder: <strong>{rootLabel ?? "ROLAND"}</strong>. One click restores it — no
                picker. Put the RC-600 in USB Storage first if you are writing to the pedal.
              </p>
              <div className="row-actions" style={{ justifyContent: "center" }}>
                <button type="button" className="btn primary" onClick={() => void reconnectLastFolder()}>
                  <Icon name="restore" size={14} />
                  Reconnect folder
                </button>
                <button type="button" className="btn" onClick={() => void openDirectory()}>
                  <Icon name="folderOpen" size={14} />
                  Choose a different folder
                </button>
                <button type="button" className="btn ghost" onClick={() => void forgetSavedFolder()}>
                  Forget saved folder
                </button>
              </div>
              {usbEjectLocal ? (
                <p className="hint">
                  When you are done, Eject USB tells the RC-600 to disconnect so you can power off.
                </p>
              ) : (
                <p className="hint">
                  When you are done, Eject USB releases the folder so you can eject BOSS RC-600 in
                  File Explorer and power off.
                </p>
              )}
            </>
          ) : (
            <>
              <h2>Open the ROLAND folder</h2>
              <p>
                Put the RC-600 in USB Storage (MENU → USB → STORAGE ON) or choose a backup on disk.
                Prefer working on a <strong>copy</strong>. Chrome/Edge remember the folder after the
                first pick.
              </p>
              <p>Chrome/Edge: Open folder. Firefox: ZIP or file picker.</p>
              <div className="row-actions" style={{ justifyContent: "center" }}>
                <button type="button" className="btn primary" onClick={() => void openDirectory()}>
                  <Icon name="folderOpen" size={14} />
                  Open ROLAND folder
                </button>
                <button type="button" className="btn" onClick={() => void loadDemoFixtures()}>
                  Load demo fixtures
                </button>
              </div>
            </>
          )}
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
                  if (!sysBaseXml) loadSystem();
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
                    disabled={!sysDirty || saving}
                    onClick={() => void saveSystem()}
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
                  <select
                    className="mem-select"
                    aria-label="Memories"
                    value={slot ?? ""}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (Number.isFinite(next) && next > 0) loadSlot(next);
                    }}
                  >
                    {slot == null ? (
                      <option value="" disabled>
                        Select a memory
                      </option>
                    ) : null}
                    {summaries.map((s) => (
                      <option key={s.slot} value={s.slot}>
                        {String(s.slot).padStart(2, "0")} {s.name || "—"} {s.active.toUpperCase()}
                      </option>
                    ))}
                  </select>
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
                              onChange={(e) => pushOps({ type: "name", name: e.target.value })}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {tab === "loop" && model ? <LoopTab model={model} onPatch={pushOps} /> : null}

                    {tab === "assigns" && model ? (
                      <AssignTab model={model} onPatch={pushOps} />
                    ) : null}

                    {tab === "ctl" && model ? <ControlTab model={model} onPatch={pushOps} /> : null}

                    {tab === "input" && model ? <InputTab model={model} onPatch={pushOps} /> : null}

                    {tab === "output" && model ? (
                      <OutputTab model={model} onPatch={pushOps} />
                    ) : null}

                    {tab === "mixer" && model ? <MixerTab model={model} onPatch={pushOps} /> : null}

                    {tab === "ifx" && model ? <InputFxTab model={model} onPatch={pushOps} /> : null}

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
                              onChange={(e) =>
                                pushOps({
                                  type: "tfx",
                                  section: "SETUP",
                                  tags: { A: String(Number(e.target.value) || 0) },
                                })
                              }
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
                          disabled={!copyTargets.size || !backupAck || saving}
                          onClick={() => void applyCopy()}
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
                {!sysBaseXml ? (
                  <p>SYSTEM1/2.RC0 not found in this folder.</p>
                ) : (
                  <SystemTab
                    baseXml={sysBaseXml}
                    ops={sysOps}
                    side={sysSide}
                    onPatch={pushSysOps}
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
