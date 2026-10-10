import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type MemoryModel,
  type MemorySummary,
  type TagMap,
  parseMemory,
  parseSystem,
  pickActiveSystem,
  pickActiveXml,
  memoryFilesAfterSave,
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
import { copyTrackWavFolder } from "@rc600/files/wave";
import type { CaptureMemory } from "./presets/inputFxCapture";
import {
  assembleRemote,
  ejectUsbStorage,
  fetchSession,
  fetchUsbStatus,
  lockSession,
  type SessionInfo,
} from "./api";
import { MidiBar } from "./components/MidiBar";
import { IosMidiNotice } from "./components/IosMidiNotice";
import { LoopTab } from "./components/LoopTab";
import { ControlTab } from "./components/ControlTab";
import { AssignTab } from "./components/AssignTab";
import { InputTab } from "./components/InputTab";
import { OutputTab } from "./components/OutputTab";
import { MixerTab } from "./components/MixerTab";
import { InputFxTab } from "./components/InputFxTab";
import { TrackFxTab } from "./components/TrackFxTab";
import { AudioTab } from "./components/AudioTab";
import { SystemTab } from "./components/SystemTab";
import { PlayDrumTab } from "./components/PlayDrumTab";
import { RhythmConverterTab } from "./components/RhythmConverterTab";
import { SetlistPanel } from "./components/SetlistPanel";
import { TunerTab } from "./components/TunerTab";
import { LicenseScreen } from "./components/LicenseScreen";
import { PlatformSelect } from "./components/PlatformSelect";
import { MemoryCopyModal } from "./components/MemoryCopyModal";
import { MemoryApplyTargetsModal } from "./components/MemoryApplyTargetsModal";
import { UsbConnectModal } from "./components/UsbConnectModal";
import {
  loadMemoryClipboard,
  loadSkipApplyConfirm,
  saveMemoryClipboard,
  saveSkipApplyConfirm,
  wavTracksForSelection,
  type MemoryClipboard,
  type MemoryCopySelection,
} from "./presets/memoryClipboard";
import { Icon } from "./components/Icon";
import { DevLicenseSlot } from "./dev/DevLicenseSlot";
import {
  Rc600Midi,
  midiEnvironment,
  isLikelyRc600,
  preferRc600Output,
  loadMidiPrefs,
  queryMidiPermission,
  saveMidiPrefs,
  shouldReuseMidiAccess,
  shouldReloadSavedMemory,
  shouldSyncPedalOnMemorySelect,
  midiSendChannels,
  initialMidiChannel,
  USB_MIDI_SETTLE_MS,
  MEMORY_RELOAD_SETTLE_MS,
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
import { parseRhythmChannel } from "./drumMap";
import {
  findRhythmKitAssign,
  kitIndexToCcValue,
  resolveRhythmKitAssign,
  type RhythmKitMidiAssign,
} from "@rc600/catalog/rhythm-kit-midi";
import {
  appendSlotDraft,
  clearSlotDraft,
  dirtySlotNumbers,
  type DraftMap,
} from "./presets/memoryDrafts";
import { usePersistedTab } from "./uiTabs";
import { MemoryChainBar } from "./components/MemoryChainView";
import { NavigationBreadcrumb } from "./components/NavigationBreadcrumb";
import type { SetlistMidiAction } from "./presets/playlist";
import { isDemoPage } from "./demoMode";
import { DemoModeProvider } from "./demoModeContext";

const WORKSPACES = ["memory", "system", "play-drum", "setlists", "tuner"] as const;
type Workspace = (typeof WORKSPACES)[number];
const RHYTHM_CONVERTER_VIEWS = ["closed", "open"] as const;
type RhythmConverterView = (typeof RHYTHM_CONVERTER_VIEWS)[number];

const MEMORY_TABS = [
  "info",
  "loop",
  "audio",
  "ctl",
  "assigns",
  "input",
  "output",
  "mixer",
  "ifx",
  "tfx",
] as const;
type TabId = (typeof MEMORY_TABS)[number];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function sysSectionTag(
  xml: string,
  side: "1" | "2",
  ops: PatchOp[],
  section: string,
  tag: string,
): string | undefined {
  const sys = parseSystem(xml, side);
  let raw: string | undefined = sys.sections[section]?.[tag];
  for (const op of ops) {
    if (op.type === "section" && op.scope === "sys" && op.section === section && op.tags[tag] != null) {
      raw = op.tags[tag];
    }
  }
  return raw;
}

export function App() {
  const demoMode = isDemoPage();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [rootLabel, setRootLabel] = useState<string | null>(null);
  const dirHandleRef = useRef<DirectoryHandleLike | null>(null);
  const [hasDirHandle, setHasDirHandle] = useState(false);
  const [folderReady, setFolderReady] = useState(false);
  const [pendingHandle, setPendingHandle] = useState<DirectoryHandleLike | null>(null);
  const [usbEjectLocal, setUsbEjectLocal] = useState(false);
  const [usbVolumePresent, setUsbVolumePresent] = useState(false);
  const [usbConnectOpen, setUsbConnectOpen] = useState(false);
  const [ejecting, setEjecting] = useState(false);
  const [backupAck, setBackupAck] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState<"a" | "b">("a");
  const [baseXml, setBaseXml] = useState("");
  const [drafts, setDrafts] = useState<DraftMap>(() => new Map());
  const [tab, setTab] = usePersistedTab<TabId>("memory", "loop", MEMORY_TABS, {
    persist: !demoMode,
  });
  const [workspace, setWorkspace] = usePersistedTab<Workspace>("workspace", "memory", WORKSPACES, {
    persist: !demoMode,
  });
  const [setlistBackground, setSetlistBackground] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discardAllOpen, setDiscardAllOpen] = useState(false);
  const [rhythmConverterView, setRhythmConverterView] = usePersistedTab<RhythmConverterView>(
    "rhythmConverter",
    "closed",
    RHYTHM_CONVERTER_VIEWS,
    { persist: !demoMode },
  );
  const rhythmConverterOpen = rhythmConverterView === "open";
  const setRhythmConverterOpen = useCallback(
    (open: boolean) => setRhythmConverterView(open ? "open" : "closed"),
    [setRhythmConverterView],
  );
  /** Stays mounted after the first open so a closed converter keeps its file and edits. */
  const [rhythmConverterMounted, setRhythmConverterMounted] = useState(rhythmConverterOpen);

  function openRhythmConverter() {
    setRhythmConverterMounted(true);
    setRhythmConverterOpen(true);
  }

  /** What the converter has not saved yet (null when nothing); Close asks before leaving it. */
  const rhythmConverterUnsavedRef = useRef<string | null>(null);

  function closeRhythmConverter() {
    const pending = rhythmConverterUnsavedRef.current;
    if (pending && !window.confirm(`${pending}\n\nClose the Rhythm Converter anyway?`)) return;
    setRhythmConverterOpen(false);
  }

  useEffect(() => {
    if (!rhythmConverterOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [rhythmConverterOpen]);

  const midiRef = useRef(new Rc600Midi());
  const pendingMemoryReloadRef = useRef<{
    slot: number;
    kit: number | null;
    assign: RhythmKitMidiAssign | null;
  } | null>(null);
  const usbReleasedAtRef = useRef(0);
  const ignoreIncomingPcUntilRef = useRef(0);
  const recallPedalMemoryRef = useRef<(targetSlot: number, xml: string) => void>(() => {});
  const env = useMemo(() => midiEnvironment(), []);
  const midiPrefs = useMemo(() => loadMidiPrefs(), []);
  const [midiAccess, setMidiAccess] = useState(false);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [outId, setOutId] = useState<string | null>(midiPrefs.outId);
  const [connected, setConnected] = useState<string | null>(null);
  const [midiCh, setMidiCh] = useState(() => initialMidiChannel(midiPrefs));
  const [midiBusy, setMidiBusy] = useState(() => env.supported && midiPrefs.allowed);

  const [sysSide, setSysSide] = useState<"1" | "2">("1");
  const [sysBaseXml, setSysBaseXml] = useState("");
  const [sysOps, setSysOps] = useState<PatchOp[]>([]);
  const [sysDirty, setSysDirty] = useState(false);
  const [memoryClipboard, setMemoryClipboard] = useState<MemoryClipboard | null>(() =>
    loadMemoryClipboard(),
  );
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [massApplyOpen, setMassApplyOpen] = useState(false);
  const [applyConfirm, setApplyConfirm] = useState<{
    targets: number[];
    skipChecked: boolean;
  } | null>(null);

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
    if (demoMode) return;
    let cancelled = false;
    let inFlight = false;
    async function refreshUsb() {
      if (inFlight) return;
      inFlight = true;
      try {
        const info = await fetchUsbStatus();
        if (cancelled) return;
        setUsbEjectLocal(info.eject);
        setUsbVolumePresent(info.connected);
      } finally {
        inFlight = false;
      }
    }
    void refreshUsb();
    const timer = window.setInterval(() => void refreshUsb(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [demoMode]);

  const sessionOk = session?.ok === true;
  const requireLicense = session?.requireLicense === true;
  const slots = useMemo(() => listMemorySlots(files), [files]);
  const summaries: MemorySummary[] = useMemo(() => {
    return slots.map((s) => {
      const a = files.get(slotFileName(s, "A")) ?? "";
      const b = files.get(slotFileName(s, "B")) ?? "";
      if (a && b) return summarizePair(s, a, b);
      const only = a || b;
      const summary = summarizePair(s, only, only);
      return {
        ...summary,
        countA: a ? summary.countA : "0000",
        countB: b ? summary.countB : "0000",
        active: (a ? "a" : "b") as "a" | "b",
      };
    });
  }, [files, slots]);

  const ops = useMemo(
    () => (slot == null ? [] : (drafts.get(slot) ?? [])),
    [drafts, slot],
  );
  const dirty = ops.length > 0;
  const dirtySlots = useMemo(() => dirtySlotNumbers(drafts), [drafts]);
  const anyMemoryDirty = dirtySlots.length > 0;
  const filesRef = useRef(files);
  filesRef.current = files;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const baseXmlRef = useRef(baseXml);
  baseXmlRef.current = baseXml;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const memListRef = useRef<HTMLDivElement>(null);
  const activeSideRef = useRef(activeSide);
  activeSideRef.current = activeSide;
  const backupAckRef = useRef(backupAck);
  backupAckRef.current = backupAck;

  const pedalMemories = useCallback((): CaptureMemory[] => {
    const map = filesRef.current;
    const out: CaptureMemory[] = [];
    for (const s of listMemorySlots(map)) {
      const a = map.get(slotFileName(s, "A")) ?? "";
      const b = map.get(slotFileName(s, "B")) ?? "";
      const xml = a && b ? pickActiveXml(a, b).xml : a || b;
      if (xml) out.push({ slot: s, xml });
    }
    return out;
  }, []);

  const baseModel: MemoryModel | null = useMemo(() => {
    if (!baseXml || slot == null) return null;
    return parseMemory(baseXml, slot);
  }, [baseXml, slot]);

  const model: MemoryModel | null = useMemo(() => {
    if (!baseModel) return null;
    return applyOpsToModel(baseModel, ops);
  }, [baseModel, ops]);

  const systemModel = useMemo(() => {
    if (!sysBaseXml) return null;
    return { side: sysSide, count: sysBaseXml.match(/<count>([^<]+)<\/count>/)?.[1] ?? "—" };
  }, [sysBaseXml, sysSide]);

  const systemCtlCh = useMemo(() => {
    if (!sysBaseXml) return null;
    const raw = sysSectionTag(sysBaseXml, sysSide, sysOps, "MIDI", "A");
    if (raw == null || raw === "") return null;
    return parseRhythmChannel(raw);
  }, [sysBaseXml, sysSide, sysOps]);

  const rhythmCh = useMemo(() => {
    if (!sysBaseXml) return midiCh;
    return parseRhythmChannel(sysSectionTag(sysBaseXml, sysSide, sysOps, "MIDI", "C"));
  }, [sysBaseXml, sysSide, sysOps, midiCh]);

  const sendChannels = useMemo(
    () => midiSendChannels(midiCh, rhythmCh, systemCtlCh ?? midiCh),
    [midiCh, rhythmCh, systemCtlCh],
  );
  const sendChannelsRef = useRef(sendChannels);
  sendChannelsRef.current = sendChannels;

  useEffect(() => {
    if (slot == null || workspace !== "memory") return;
    const list = memListRef.current;
    if (!list || list.clientHeight === 0) return;
    const row = list.querySelector(`[data-slot="${slot}"]`);
    if (!(row instanceof HTMLElement)) return;
    const style = getComputedStyle(list);
    const inset =
      (Number.parseFloat(style.borderTopWidth) || 0) +
      (Number.parseFloat(style.paddingTop) || 0);
    const top = Math.max(
      0,
      list.scrollTop + (row.getBoundingClientRect().top - (list.getBoundingClientRect().top + inset)),
    );
    if (Math.abs(list.scrollTop - top) < 2) return;
    list.scrollTo({ top, behavior: "smooth" });
  }, [slot, workspace, summaries.length]);

  const loadSlot = useCallback(
    (s: number, map: Map<string, string> = files, opts?: { syncPedal?: boolean }) => {
      const a = map.get(slotFileName(s, "A"));
      const b = map.get(slotFileName(s, "B"));
      if (!a && !b) {
        setError(`Memory ${s} not found`);
        return;
      }
      let xml: string;
      if (a && b) {
        const picked = pickActiveXml(a, b);
        setActiveSide(picked.side);
        xml = picked.xml;
        setBaseXml(xml);
      } else {
        setActiveSide(a ? "a" : "b");
        xml = (a || b)!;
        setBaseXml(xml);
      }
      setSlot(s);
      setError(null);
      if (opts?.syncPedal) recallPedalMemoryRef.current(s, xml);
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

  const pushOps = useCallback(
    (next: PatchOp | PatchOp[]) => {
      if (demoMode || slot == null) return;
      setDrafts((prev) => appendSlotDraft(prev, slot, normalizeOps(next)));
    },
    [demoMode, slot],
  );

  const pushSysOps = useCallback(
    (next: PatchOp | PatchOp[]) => {
      if (demoMode) return;
      setSysOps((prev) => [...prev, ...normalizeOps(next)]);
      setSysDirty(true);
    },
    [demoMode],
  );

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
      setDrafts(new Map());
      setStatus(demoMode ? "" : `${map.size} files · ${label}`);
      const slotsNow = listMemorySlots(map);
      const preferred = opts?.preferredSlot;
      const first = preferred && slotsNow.includes(preferred) ? preferred : slotsNow[0];
      if (first) loadSlot(first, map);
      if (hasSystem(map)) loadSystem(map);
    },
    [demoMode, loadSlot, loadSystem],
  );
  const applyRolandFilesRef = useRef(applyRolandFiles);
  applyRolandFilesRef.current = applyRolandFiles;

  useEffect(() => {
    if (demoMode) {
      setFolderReady(true);
      return;
    }
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
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode) return;
    void loadDemoFixtures();
  }, [demoMode]);

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

  async function openDirectory(): Promise<boolean> {
    setError(null);
    try {
      const result = await pickRolandDirectory();
      if (!result) {
        setError("File System Access API is unavailable — use Import folder or Import ZIP.");
        return false;
      }
      await attachDirectoryHandle(result.handle, result.files.rootLabel);
      saveFolderMeta({ backupAck: false });
      applyRolandFiles(result.files.files, result.files.rootLabel, { backupAck: false });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return false;
      setError(String(e));
      return false;
    }
  }

  async function confirmUsbConnect() {
    const ok = await openDirectory();
    if (!ok) return;
    setUsbConnectOpen(false);
    setWorkspace("memory");
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
    if (anyMemoryDirty || sysDirty) {
      setError("Save memory/system first, then eject USB so the RC-600 can power off.");
      return;
    }
    setEjecting(true);
    setError(null);
    dropLiveHandle();
    usbReleasedAtRef.current = Date.now();
    midiRef.current.disconnect();
    setConnected(null);
    setFiles(new Map());
    setSlot(null);
    setBaseXml("");
    setDrafts(new Map());
    setSysBaseXml("");
    setSysOps([]);
    setSysDirty(false);
    setPendingHandle(await loadRolandHandle());
    try {
      const reloadHint = pendingMemoryReloadRef.current
        ? " Then Allow MIDI — the editor switches memories and back so the pedal loads the saved kit."
        : "";
      if (usbEjectLocal) {
        const result = await ejectUsbStorage();
        setStatus(`${result.message}${reloadHint}`);
        if (!result.ok) setError(result.message);
        else setUsbVolumePresent(false);
      } else {
        setStatus(
          `Folder released. Eject BOSS RC-600 in File Explorer, wait for DISCONNECTING…, then power off.${reloadHint}`,
        );
      }
    } finally {
      setEjecting(false);
    }
  }

  async function saveSlotXml(
    targetSlot: number,
    xml: string,
    slotOps: PatchOp[],
    map: Map<string, string>,
  ): Promise<{ written: { path: string; xml: string }[]; saved: string; side: "a" | "b" }> {
    const aPath = slotFileName(targetSlot, "A");
    const bPath = slotFileName(targetSlot, "B");
    const a = map.get(aPath);
    const b = map.get(bPath);
    if (!a && !b) throw new Error(`Memory ${targetSlot} not found`);
    const picked =
      targetSlot === slotRef.current && xml
        ? { side: activeSideRef.current, xml }
        : a && b
          ? pickActiveXml(a, b)
          : { side: (a ? "a" : "b") as "a" | "b", xml: (a || b)! };
    const base = targetSlot === slotRef.current ? xml : picked.xml;
    const { xml: saved } = await assembleRemote({ kind: "patch", xml: base, ops: slotOps });
    const pair = memoryFilesAfterSave(saved);
    return {
      saved,
      side: picked.side,
      written: [
        { path: aPath, xml: pair.xmlA },
        { path: bPath, xml: pair.xmlB },
      ],
    };
  }

  async function commitSlotFiles(
    written: { path: string; xml: string }[],
    map: Map<string, string>,
  ): Promise<Map<string, string>> {
    const next = new Map(map);
    for (const file of written) next.set(file.path, file.xml);
    const handle = dirHandleRef.current;
    if (handle) {
      for (const file of written) {
        await writeFileToDirectory(handle, file.path, file.xml);
      }
    }
    return next;
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
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const { written, saved } = await saveSlotXml(slot, baseXml, ops, files);
      const next = await commitSlotFiles(written, files);
      setFiles(next);
      setBaseXml(saved);
      setDrafts((prev) => clearSlotDraft(prev, slot));

      if (dirHandleRef.current) {
        pendingMemoryReloadRef.current = {
          slot,
          kit: model ? num(model.rhythm, "D", 0) : null,
          assign: model ? findRhythmKitAssign(model.assigns) : null,
        };
        setStatus(
          `Saved MEMORY${String(slot).padStart(3, "0")}A/B. On the pedal, switch to another memory and back so it loads the new kit. USB Storage cannot change the kit that is already in RAM.`,
        );
      } else {
        setStatus(`Updated MEMORY${String(slot).padStart(3, "0")}A/B — Export ZIP to copy onto the pedal`);
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

  async function saveAll() {
    if (dirtySlots.length === 0) return;
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
      let next = new Map(files);
      let savedCount = 0;
      for (const s of dirtySlots) {
        const slotOps = drafts.get(s) ?? [];
        if (slotOps.length === 0) continue;
        const { written, saved } = await saveSlotXml(s, s === slot ? baseXml : "", slotOps, next);
        next = await commitSlotFiles(written, next);
        if (s === slot) setBaseXml(saved);
        savedCount += 1;
      }
      setFiles(next);
      setDrafts(new Map());
      if (dirHandleRef.current && slot != null && dirtySlots.includes(slot)) {
        pendingMemoryReloadRef.current = {
          slot,
          kit: model ? num(model.rhythm, "D", 0) : null,
          assign: model ? findRhythmKitAssign(model.assigns) : null,
        };
      }
      setStatus(
        dirHandleRef.current
          ? `Saved ${savedCount} memor${savedCount === 1 ? "y" : "ies"} (A and B). On the pedal, switch memory and back so the new kit loads.`
          : `Updated ${savedCount} memor${savedCount === 1 ? "y" : "ies"} — Export ZIP to copy onto the pedal`,
      );
    } catch (e) {
      setError(String(e));
      if (String(e).includes("License required") || String(e).includes("expired")) {
        void fetchSession().then(setSession);
      }
    } finally {
      setSaving(false);
    }
  }

  function discardMemory() {
    if (slot == null || !dirty) return;
    setDrafts((prev) => clearSlotDraft(prev, slot));
    setStatus(`Discarded memory ${String(slot).padStart(2, "0")}`);
  }

  function discardAll() {
    const n = dirtySlots.length;
    setDrafts(new Map());
    setDiscardAllOpen(false);
    setStatus(`Discarded ${n} unsaved memor${n === 1 ? "y" : "ies"}`);
  }

  async function writeSystemXml(opsToApply: PatchOp[]): Promise<string> {
    if (!sysBaseXml) throw new Error("SYSTEM1/2.RC0 not loaded");
    const { xml: saved } = await assembleRemote({
      kind: "patch",
      xml: sysBaseXml,
      ops: opsToApply,
    });
    const pair = memoryFilesAfterSave(saved);
    const written = [
      { path: systemFileName("1"), xml: pair.xmlA },
      { path: systemFileName("2"), xml: pair.xmlB },
    ];
    const next = await commitSlotFiles(written, filesRef.current);
    setFiles(next);
    setSysBaseXml(saved);
    setSysOps([]);
    setSysDirty(false);
    setSysSide("1");
    return saved;
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
      await writeSystemXml(sysOps);
      setStatus(
        dirHandleRef.current
          ? "Saved SYSTEM1.RC0 and SYSTEM2.RC0"
          : "System updated — Export ZIP to copy onto the pedal",
      );
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
    if (anyMemoryDirty || sysDirty) {
      setError(
        "Unsaved edits are not in the ZIP yet. Save memory/system first (needs the server), then Export ZIP.",
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

  async function applyMemoryClipboard(targets: Iterable<number>) {
    const clip = memoryClipboard;
    const targetSet = targets instanceof Set ? targets : new Set(targets);
    if (!clip || targetSet.size === 0) return;
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
      // Prefer live dirty source if clipboard is from the current memory
      let sourceXml = clip.sourceXml;
      const sourceIsCurrentDirty = clip.sourceSlot === slot && dirty && Boolean(baseXml);
      if (sourceIsCurrentDirty && baseXml) {
        sourceXml = (await assembleRemote({ kind: "patch", xml: baseXml, ops })).xml;
      }

      const next = new Map(files);
      if (sourceIsCurrentDirty && slot != null) {
        const pair = memoryFilesAfterSave(sourceXml);
        next.set(slotFileName(slot, "A"), pair.xmlA);
        next.set(slotFileName(slot, "B"), pair.xmlB);
        if (dirHandleRef.current) {
          await writeFileToDirectory(dirHandleRef.current, slotFileName(slot, "A"), pair.xmlA);
          await writeFileToDirectory(dirHandleRef.current, slotFileName(slot, "B"), pair.xmlB);
        }
        setBaseXml(sourceXml);
      }

      const clearedTargets: number[] = [];
      const wavTracks = wavTracksForSelection(clip.selection);
      for (const target of targetSet) {
        if (target === clip.sourceSlot) continue;
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
          selection: clip.selection,
          mode: clip.selection.copyAll ? "all" : undefined,
        });
        const pair = memoryFilesAfterSave(patched);
        next.set(aPath, pair.xmlA);
        next.set(bPath, pair.xmlB);
        clearedTargets.push(target);
        if (dirHandleRef.current) {
          await writeFileToDirectory(dirHandleRef.current, aPath, pair.xmlA);
          await writeFileToDirectory(dirHandleRef.current, bPath, pair.xmlB);
          for (const t of wavTracks) {
            await copyTrackWavFolder(dirHandleRef.current, clip.sourceSlot, target, t);
          }
        }
      }
      setFiles(next);
      if (sourceIsCurrentDirty || clearedTargets.length) {
        setDrafts((prev) => {
          let out = sourceIsCurrentDirty && slot != null ? clearSlotDraft(prev, slot) : prev;
          for (const t of clearedTargets) out = clearSlotDraft(out, t);
          return out;
        });
      }
      setStatus(
        `Applied clipboard (${clip.summary}) to ${clearedTargets.length || targetSet.size} memories`,
      );
    } catch (e) {
      setError(String(e));
      if (String(e).includes("License required") || String(e).includes("expired")) {
        void fetchSession().then(setSession);
      }
    } finally {
      setSaving(false);
    }
  }

  function requestApply(targets: number[]) {
    const filtered = targets.filter((t) => t !== memoryClipboard?.sourceSlot);
    if (!filtered.length || !memoryClipboard) return;
    if (loadSkipApplyConfirm()) {
      void applyMemoryClipboard(filtered);
      return;
    }
    setApplyConfirm({ targets: filtered, skipChecked: false });
  }

  async function captureMemoryClipboard(selection: MemoryCopySelection) {
    if (!slot || !baseXml) return;
    try {
      const sourceXml = dirty
        ? (await assembleRemote({ kind: "patch", xml: baseXml, ops })).xml
        : baseXml;
      const name = model?.name ?? "";
      const clip = saveMemoryClipboard({
        sourceSlot: slot,
        sourceName: name,
        sourceXml,
        selection,
      });
      setMemoryClipboard(clip);
      setCopyModalOpen(false);
      setStatus(`Copied ${clip.summary} from memory ${String(slot).padStart(2, "0")}`);
    } catch (e) {
      setError(String(e));
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
        preferRc600Output(ports.outputs.filter((p) => isLikelyRc600(p.name))) ??
        preferRc600Output(ports.outputs);
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
      if (demoMode) return;
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
    [applyMidiPorts, demoMode],
  );

  const playDrumNotes = useCallback(
    (notes: readonly number[], velocity: number, down: boolean) => {
      if (demoMode || dirHandleRef.current) return;
      if (!midiRef.current.connectedName && outId) {
        midiRef.current.channel = midiCh;
        midiRef.current.listenChannels = sendChannels;
        if (midiRef.current.connect(outId)) setConnected(midiRef.current.connectedName);
      }
      for (const note of notes) {
        for (const ch of sendChannels) {
          if (down) midiRef.current.noteOn(note, velocity, ch);
          else midiRef.current.noteOff(note, ch);
        }
      }
    },
    [demoMode, midiCh, outId, sendChannels],
  );

  const silenceRhythm = useCallback(() => {
    for (const ch of sendChannels) midiRef.current.allNotesOff(ch);
  }, [sendChannels]);

  function emitRhythmKitCc(kit: number, assign: RhythmKitMidiAssign) {
    if (!midiRef.current.connectedName && outId) {
      midiRef.current.channel = midiCh;
      midiRef.current.listenChannels = sendChannelsRef.current;
      if (midiRef.current.connect(outId)) setConnected(midiRef.current.connectedName);
    }
    midiRef.current.channel = midiCh;
    midiRef.current.listenChannels = sendChannelsRef.current;
    midiRef.current.controlChange(
      assign.cc,
      kitIndexToCcValue(kit, assign),
      true,
      sendChannelsRef.current,
    );
  }

  function selectPedalRhythmKit(kit: number) {
    if (demoMode || dirHandleRef.current) return;
    emitRhythmKitCc(kit, resolveRhythmKitAssign(model?.assigns));
  }

  function recallPedalMemory(targetSlot: number, xml: string) {
    if (
      !shouldSyncPedalOnMemorySelect({
        midiConnected: Boolean(midiRef.current.connectedName || connected),
        usbStorageOpen: Boolean(dirHandleRef.current),
      })
    ) {
      return;
    }
    if (!midiRef.current.connectedName && outId) {
      midiRef.current.channel = midiCh;
      midiRef.current.listenChannels = sendChannelsRef.current;
      if (midiRef.current.connect(outId)) setConnected(midiRef.current.connectedName);
    }
    if (!midiRef.current.connectedName) return;
    ignoreIncomingPcUntilRef.current = Date.now() + MEMORY_RELOAD_SETTLE_MS + 250;
    const parsed = parseMemory(xml, targetSlot);
    const kit = num(parsed.rhythm, "D", 0);
    const assign = resolveRhythmKitAssign(parsed.assigns);
    midiRef.current.channel = midiCh;
    midiRef.current.listenChannels = sendChannelsRef.current;
    for (const ch of sendChannelsRef.current) midiRef.current.allNotesOff(ch);
    midiRef.current.reloadMemory(targetSlot, sendChannelsRef.current);
    window.setTimeout(() => {
      midiRef.current.channel = midiCh;
      midiRef.current.listenChannels = sendChannelsRef.current;
      midiRef.current.controlChange(
        assign.cc,
        kitIndexToCcValue(kit, assign),
        true,
        sendChannelsRef.current,
      );
    }, MEMORY_RELOAD_SETTLE_MS + 40);
    setStatus(
      `Recalled memory ${String(targetSlot).padStart(2, "0")} on Rx CH ${sendChannelsRef.current.map((c) => c + 1).join("/")} so pads use that kit.`,
    );
  }

  async function recallMemoryBySlot(targetSlot: number): Promise<void> {
    const safeSlot = Math.max(1, Math.min(99, Math.round(targetSlot)));
    const a = files.get(slotFileName(safeSlot, "A"));
    const b = files.get(slotFileName(safeSlot, "B"));
    if (a || b) {
      const xml = a && b ? pickActiveXml(a, b).xml : (a || b)!;
      loadSlot(safeSlot, files);
      recallPedalMemory(safeSlot, xml);
      await new Promise((resolve) => window.setTimeout(resolve, MEMORY_RELOAD_SETTLE_MS + 80));
      return;
    }
    if (
      !shouldSyncPedalOnMemorySelect({
        midiConnected: Boolean(midiRef.current.connectedName || connected),
        usbStorageOpen: Boolean(dirHandleRef.current),
      })
    ) {
      return;
    }
    if (!midiRef.current.connectedName && outId) {
      midiRef.current.channel = midiCh;
      midiRef.current.listenChannels = sendChannelsRef.current;
      if (midiRef.current.connect(outId)) setConnected(midiRef.current.connectedName);
    }
    if (!midiRef.current.connectedName) return;
    ignoreIncomingPcUntilRef.current = Date.now() + MEMORY_RELOAD_SETTLE_MS + 250;
    for (const ch of sendChannelsRef.current) midiRef.current.allNotesOff(ch);
    midiRef.current.reloadMemory(safeSlot, sendChannelsRef.current);
    setStatus(
      `Recalled memory ${String(safeSlot).padStart(2, "0")} on Rx CH ${sendChannelsRef.current.map((c) => c + 1).join("/")}.`,
    );
    await new Promise((resolve) => window.setTimeout(resolve, MEMORY_RELOAD_SETTLE_MS + 40));
  }

  function sendSetlistControlChange(action: SetlistMidiAction) {
    if (
      !shouldSyncPedalOnMemorySelect({
        midiConnected: Boolean(midiRef.current.connectedName || connected),
        usbStorageOpen: Boolean(dirHandleRef.current),
      })
    ) {
      return;
    }
    const channel = Math.max(1, Math.min(16, action.channel)) - 1;
    midiRef.current.controlChange(action.controller, action.value, true, [channel]);
  }

  async function changeSetlistMemory(targetSlot: number): Promise<void> {
    const safeSlot = Math.max(1, Math.min(99, Math.round(targetSlot)));
    const a = files.get(slotFileName(safeSlot, "A"));
    const b = files.get(slotFileName(safeSlot, "B"));
    if (a || b) loadSlot(safeSlot, files);
    if (
      !shouldSyncPedalOnMemorySelect({
        midiConnected: Boolean(midiRef.current.connectedName || connected),
        usbStorageOpen: Boolean(dirHandleRef.current),
      })
    ) {
      return;
    }
    for (const ch of sendChannelsRef.current) midiRef.current.allNotesOff(ch);
    midiRef.current.programChange(safeSlot, undefined, midiCh);
    setStatus(`Setlist selected memory ${String(safeSlot).padStart(2, "0")} on MIDI Ch.${midiCh + 1}.`);
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }

  recallPedalMemoryRef.current = recallPedalMemory;

  const applyMidiPortsRef = useRef(applyMidiPorts);
  applyMidiPortsRef.current = applyMidiPorts;
  const requestMidiRef = useRef(requestMidi);
  requestMidiRef.current = requestMidi;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  useEffect(() => {
    midiRef.current.channel = midiCh;
    midiRef.current.listenChannels = sendChannels;
    saveMidiPrefs({ channel: midiCh, rhythmChannel: midiCh });
  }, [midiCh, sendChannels]);

  useEffect(() => {
    const pending = pendingMemoryReloadRef.current;
    if (
      !pending ||
      !shouldReloadSavedMemory({ midiConnected: Boolean(connected), usbStorageOpen: hasDirHandle })
    ) {
      return;
    }
    let cancelled = false;
    const elapsed = usbReleasedAtRef.current ? Date.now() - usbReleasedAtRef.current : USB_MIDI_SETTLE_MS;
    const wait = Math.max(0, USB_MIDI_SETTLE_MS - elapsed);
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const still = pendingMemoryReloadRef.current;
      if (!still) return;
      pendingMemoryReloadRef.current = null;
      midiRef.current.channel = midiCh;
      midiRef.current.listenChannels = sendChannels;
      for (const ch of sendChannels) midiRef.current.allNotesOff(ch);
      midiRef.current.reloadMemory(still.slot, sendChannels);
      if (still.assign && still.kit != null) {
        window.setTimeout(() => {
          midiRef.current.channel = midiCh;
          midiRef.current.listenChannels = sendChannels;
          midiRef.current.controlChange(
            still.assign!.cc,
            kitIndexToCcValue(still.kit!, still.assign!),
            true,
            sendChannels,
          );
        }, MEMORY_RELOAD_SETTLE_MS + 40);
      }
      setStatus(
        `Reloaded memory ${String(still.slot).padStart(2, "0")} so the pedal uses the saved kit.`,
      );
    }, wait);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connected, midiCh, hasDirHandle, sendChannels]);

  useEffect(() => {
    const midi = midiRef.current;
    midi.onStateChange = (ports) => {
      applyMidiPortsRef.current(ports, !connectedRef.current);
    };
    midi.onIncomingProgramChange = (incomingSlot) => {
      if (Date.now() < ignoreIncomingPcUntilRef.current) return;
      const map = filesRef.current;
      const a = map.get(slotFileName(incomingSlot, "A"));
      const b = map.get(slotFileName(incomingSlot, "B"));
      if (!a && !b) return;
      loadSlot(incomingSlot, map);
      const xml = a && b ? pickActiveXml(a, b).xml : (a || b)!;
      const parsed = parseMemory(xml, incomingSlot);
      emitRhythmKitCc(num(parsed.rhythm, "D", 0), resolveRhythmKitAssign(parsed.assigns));
    };
    return () => {
      midi.onStateChange = null;
      midi.onIncomingProgramChange = null;
    };
  }, [loadSlot, midiCh, outId, sendChannels]);

  useEffect(() => {
    if (demoMode || !env.supported) return;
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
  }, [demoMode, env.supported]);

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
    { id: "audio", label: "Audio" },
    { id: "ctl", label: "Ctl Func" },
    { id: "assigns", label: "Assigns" },
    { id: "input", label: "Input" },
    { id: "output", label: "Output" },
    { id: "mixer", label: "Mixer" },
    { id: "ifx", label: "Input FX" },
    { id: "tfx", label: "Track FX" },
  ];

  if (session === null) {
    return (
      <div className="app">
        <div className="empty-state editor-panel">
          <p>Checking session…</p>
        </div>
      </div>
    );
  }

  const showDemoFixtures = !demoMode && session.license == null;

  if (requireLicense && !sessionOk && !demoMode) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="topbar-start">
            <div className="brand">
              <PlatformSelect current="rc-600" />
            </div>
          </div>
          <div className="topbar-actions">
            <DevLicenseSlot />
          </div>
        </header>
        <LicenseScreen onActivated={setSession} />
      </div>
    );
  }

  return (
    <DemoModeProvider enabled={demoMode}>
    <div className={`app${demoMode ? " demo-mode" : ""}`}>
      <header className="topbar">
        <div className="topbar-start">
          <div className="brand">
            <div className="brand-row">
              <PlatformSelect current="rc-600" />
              {demoMode ? null : (
              <MidiBar
                env={env}
                outputs={outputs}
                selectedOutId={outId}
                busy={midiBusy}
                hasAccess={midiAccess}
                onRequestAccess={() => void requestMidi(true)}
                onSelectOut={(id) => {
                  setOutId(id);
                  saveMidiPrefs({ outId: id || null });
                  if (!id) {
                    midiRef.current.disconnect();
                    setConnected(null);
                    return;
                  }
                  midiRef.current.channel = midiCh;
                  if (midiRef.current.connect(id)) {
                    setConnected(midiRef.current.connectedName);
                    saveMidiPrefs({ allowed: true, outId: id, channel: midiCh });
                  }
                }}
                channel={midiCh}
                onChannel={setMidiCh}
              />
              )}
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <DevLicenseSlot />
          <a className="btn" href="./guia.html" target="_blank" rel="noopener noreferrer" aria-label="User guide (opens in a new tab)" style={{ textDecoration: "none" }}>
            <Icon name="help" size={14} /> Guide
          </a>
          {!demoMode && requireLicense ? (
            <button
              type="button"
              className="btn ghost"
              aria-label="Clear license"
              title="Clear license: removes the license from this browser so you can use it somewhere else"
              onClick={() => {
                void lockSession().finally(() => {
                  window.location.assign("/");
                });
              }}
            >
              <Icon name="keyRemove" size={14} />
            </button>
          ) : null}
          {demoMode ? (
            <a className="btn primary" href="/" style={{ textDecoration: "none" }}>
              {session.license || !requireLicense ? "Open editor" : "Get a license"}
            </a>
          ) : null}
          {demoMode ? null : (
          <button
            type="button"
            className="btn primary"
            onClick={openDirectory}
            title="Open the ROLAND folder on USB or disk with write access. Save writes straight back to those files."
          >
            <Icon name="folderOpen" size={14} />
            Open folder
          </button>
          )}
          {showDemoFixtures ? (
          <button type="button" className="btn" onClick={loadDemoFixtures}>
            Demo fixtures
          </button>
          ) : null}
          {demoMode ? null : (
          <label
            className="btn"
            title="Load a ROLAND folder from disk without writing back. After Save, use Export ZIP to copy the files onto the pedal."
          >
            <Icon name="folderOpen" size={14} />
            Import folder
            <input
              type="file"
              multiple
              // @ts-expect-error webkitdirectory
              webkitdirectory=""
              style={{ display: "none" }}
              onChange={(e) => openFiles(e.target.files)}
            />
          </label>
          )}
          {demoMode ? null : (
          <label
            className="btn"
            title="Load a ZIP backup of the ROLAND folder. After Save, use Export ZIP to copy the files onto the pedal."
          >
            <Icon name="archive" size={14} />
            Import ZIP
            <input
              type="file"
              accept=".zip"
              style={{ display: "none" }}
              onChange={(e) => openZip(e.target.files?.[0] ?? null)}
            />
          </label>
          )}
          {demoMode ? null : (
          <button
            type="button"
            className="btn"
            disabled={!files.size}
            onClick={downloadZip}
            title="Download a ZIP backup of the loaded memories. Copy it onto the pedal if you did not use Open folder."
          >
            <Icon name="download" size={14} />
            Export ZIP
          </button>
          )}
          {demoMode ? null : hasDirHandle || usbVolumePresent ? (
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
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={ejecting}
              onClick={() => setUsbConnectOpen(true)}
              title="How to put the RC-600 in USB Storage, then open the ROLAND folder"
            >
              <Icon name="usb" size={14} />
              Connect to USB
            </button>
          )}
          {demoMode ? null : (
          <div
            className={`topbar-save-actions${anyMemoryDirty || sysDirty ? " has-pending" : ""}`}
            aria-label="Save and discard changes"
          >
            <button
              type="button"
              className="btn warn"
              disabled={!dirty || !slot || saving}
              onClick={() => void saveCurrent()}
            >
              <Icon name="save" size={14} />
              Save memory
            </button>
            <button
              type="button"
              className="btn warn"
              disabled={!anyMemoryDirty || saving}
              onClick={() => void saveAll()}
            >
              <Icon name="save" size={14} />
              Save all
            </button>
            <button
              type="button"
              className="btn ghost discard-action"
              disabled={!dirty || !slot || saving}
              onClick={discardMemory}
            >
              <Icon name="restore" size={14} />
              Discard memory
            </button>
            <button
              type="button"
              className="btn ghost discard-action"
              disabled={!anyMemoryDirty || saving}
              onClick={() => setDiscardAllOpen(true)}
            >
              <Icon name="restore" size={14} />
              Discard all
            </button>
          </div>
          )}
          {(() => {
            const statusText = [
              demoMode ? "Demo · view only" : null,
              !session.license && session.mode === "open" ? "public" : null,
              status || null,
            ]
              .filter(Boolean)
              .join(" · ");
            const showUnsaved = dirty || sysDirty || anyMemoryDirty;
            if (!statusText && !showUnsaved) return null;
            return (
          <span
            className={`status-pill ${dirty || sysDirty ? "dirty" : ""}`}
            role="status"
            aria-live="polite"
          >
            {dirty || sysDirty ? (
              <span className="unsaved-indicator">
                <Icon name="dirty" size={11} />
                Unsaved changes
              </span>
            ) : anyMemoryDirty ? (
              <span className="unsaved-indicator">
                <Icon name="dirty" size={11} />
                Unsaved memories
              </span>
            ) : null}
            {statusText}
          </span>
            );
          })()}
        </div>
      </header>

      {demoMode ? (
        <div className="warn-banner demo-banner">
          <p>
            This is a view-only demo. Sample memories are loaded so you can look through Memory,
            System, Play Drum, Setlists, and Tuner. Nothing here is saved or sent to an RC-600.
          </p>
        </div>
      ) : null}

      {!demoMode && env.blockReason === "ios" ? <IosMidiNotice /> : null}

      {!demoMode && !backupAck && files.size > 0 && (
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

      {demoMode && files.size === 0 ? (
        <div className="main">
          <section className="editor-panel">
            <div className="empty-state">
              <h2>{error ? "Demo could not load" : "Loading demo"}</h2>
              <p>
                {error
                  ? "Sample memories could not be opened. Refresh the page to try again."
                  : "Sample memories and system settings are opening."}
              </p>
            </div>
          </section>
        </div>
      ) : files.size === 0 ? (
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
                onClick={() => setWorkspace("system")}
              >
                <Icon name="system" size={14} />
                System
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "play-drum"}
                className={`tab ${workspace === "play-drum" ? "active" : ""}`}
                onClick={() => setWorkspace("play-drum")}
              >
                <Icon name="note" size={14} />
                Play Drum
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "setlists"}
                className={`tab ${workspace === "setlists" ? "active" : ""}`}
                onClick={() => setWorkspace("setlists")}
              >
                <Icon name="scene" size={14} />
                Setlists
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "tuner"}
                className={`tab ${workspace === "tuner" ? "active" : ""}`}
                onClick={() => setWorkspace("tuner")}
              >
                <Icon name="guitar" size={14} />
                Tuner
              </button>
              <button
                type="button"
                className={`tab ${rhythmConverterOpen ? "active" : ""}`}
                aria-haspopup="dialog"
                onClick={openRhythmConverter}
              >
                <Icon name="fileMusic" size={14} />
                Rhythm Converter
              </button>
            </div>
            <NavigationBreadcrumb />
            {workspace === "tuner" ? (
              <TunerTab
                usbStorageActive={hasDirHandle}
                onEjectUsb={() => void ejectUsb()}
                onExit={() => setWorkspace("memory")}
              />
            ) : workspace === "play-drum" ? (
              <PlayDrumTab
                midiLinked={Boolean(connected)}
                midiOutHint={connected ?? undefined}
                usbStorageActive={hasDirHandle}
                onEjectUsb={() => void ejectUsb()}
                rhythmChannel={midiCh}
                onPlayNotes={playDrumNotes}
                onSilence={silenceRhythm}
                onRequestMidi={() => void requestMidi(true)}
                currentSlot={slot}
                onSelectMemory={recallMemoryBySlot}
              />
            ) : workspace === "setlists" || setlistBackground ? (
              <div
                className="setlist-panel-host"
                hidden={workspace !== "setlists"}
                aria-hidden={workspace !== "setlists"}
              >
                <SetlistPanel
                  midiLive={Boolean(connected) && !hasDirHandle}
                  usbStorageActive={hasDirHandle}
                  memories={[]}
                  currentSlot={slot}
                  defaultMidiChannel={midiCh + 1}
                  onRecallMemory={changeSetlistMemory}
                  onSendControlChange={sendSetlistControlChange}
                  onPlayNotes={playDrumNotes}
                  onSilenceDrums={silenceRhythm}
                  onRequestMidi={() => void requestMidi(true)}
                  onBackgroundPlaybackChange={setSetlistBackground}
                  onRequestShowSetlists={() => setWorkspace("setlists")}
                />
              </div>
            ) : workspace === "system" ? (
              <div className="empty-state">
                <h2>Open the ROLAND folder to edit System</h2>
                <p>Play Drum works over MIDI without a folder. Memory and System need DATA/*.RC0 files.</p>
              </div>
            ) : (
        <div className="empty-state">
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
              {usbVolumePresent ? (
                <p className="hint">
                  When you are done, Eject USB tells the RC-600 to disconnect so you can power off.
                </p>
              ) : (
                <p className="hint">
                  If the pedal is not in CONNECTING yet, click Connect to USB for the MENU → USB →
                  STORAGE steps, then Reconnect folder.
                </p>
              )}
            </>
          ) : (
            <>
              <h2>Open the ROLAND folder</h2>
              <p>
                Click <strong>Connect to USB</strong> for how to put the RC-600 in CONNECTING (MENU
                → USB → STORAGE ON), then open the ROLAND folder. Or choose a backup on disk. Prefer
                working on a <strong>copy</strong>. Chrome/Edge remember the folder after the first
                pick.
              </p>
              <p>Chrome/Edge: Open folder. Firefox: Import folder or Import ZIP.</p>
              <div className="row-actions" style={{ justifyContent: "center" }}>
                <button type="button" className="btn primary" onClick={() => void openDirectory()}>
                  <Icon name="folderOpen" size={14} />
                  Open ROLAND folder
                </button>
                {showDemoFixtures ? (
                <button type="button" className="btn" onClick={() => void loadDemoFixtures()}>
                  Load demo fixtures
                </button>
                ) : null}
              </div>
            </>
          )}
        </div>
            )}
          </section>
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
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "play-drum"}
                className={`tab ${workspace === "play-drum" ? "active" : ""}`}
                onClick={() => setWorkspace("play-drum")}
              >
                <Icon name="note" size={14} />
                Play Drum
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "setlists"}
                className={`tab ${workspace === "setlists" ? "active" : ""}`}
                onClick={() => setWorkspace("setlists")}
              >
                <Icon name="scene" size={14} />
                Setlists
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspace === "tuner"}
                className={`tab ${workspace === "tuner" ? "active" : ""}`}
                onClick={() => setWorkspace("tuner")}
              >
                <Icon name="guitar" size={14} />
                Tuner
              </button>
              <button
                type="button"
                className={`tab ${rhythmConverterOpen ? "active" : ""}`}
                aria-haspopup="dialog"
                onClick={openRhythmConverter}
              >
                <Icon name="fileMusic" size={14} />
                Rhythm Converter
              </button>
              {sysBaseXml && (workspace === "system" || sysDirty) ? (
                <>
                  <span className="status-pill" style={{ marginLeft: "auto" }}>
                    SYSTEM{sysSide} · count {systemModel?.count ?? "—"}
                  </span>
                  {demoMode ? null : (
                  <button
                    type="button"
                    className="btn warn"
                    disabled={!sysDirty || saving}
                    onClick={() => void saveSystem()}
                  >
                    <Icon name="save" size={14} />
                    Save system
                  </button>
                  )}
                </>
              ) : null}
            </div>

            <NavigationBreadcrumb />
            {workspace === "tuner" ? (
              <TunerTab
                usbStorageActive={hasDirHandle}
                onEjectUsb={() => void ejectUsb()}
                onExit={() => setWorkspace("memory")}
              />
            ) : workspace === "play-drum" ? (
              <PlayDrumTab
                midiLinked={Boolean(connected)}
                midiOutHint={connected ?? undefined}
                usbStorageActive={hasDirHandle}
                onEjectUsb={() => void ejectUsb()}
                rhythmChannel={midiCh}
                onPlayNotes={playDrumNotes}
                onSilence={silenceRhythm}
                onRequestMidi={() => void requestMidi(true)}
                memories={summaries.map((s) => ({ slot: s.slot, name: s.name }))}
                currentSlot={slot}
                onSelectMemory={recallMemoryBySlot}
              />
            ) : workspace === "setlists" || setlistBackground ? (
              <div
                className="setlist-panel-host"
                hidden={workspace !== "setlists"}
                aria-hidden={workspace !== "setlists"}
              >
                <SetlistPanel
                  midiLive={Boolean(connected) && !hasDirHandle}
                  usbStorageActive={hasDirHandle}
                  memories={summaries.map((s) => ({ slot: s.slot, name: s.name }))}
                  currentSlot={slot}
                  defaultMidiChannel={midiCh + 1}
                  onRecallMemory={changeSetlistMemory}
                  onSendControlChange={sendSetlistControlChange}
                  onPlayNotes={playDrumNotes}
                  onSilenceDrums={silenceRhythm}
                  onRequestMidi={() => void requestMidi(true)}
                  onBackgroundPlaybackChange={setSetlistBackground}
                  onRequestShowSetlists={() => setWorkspace("setlists")}
                />
              </div>
            ) : workspace === "memory" ? (
              <div className="memory-layout">
                <aside className="sidebar">
                  <div className="sidebar-head">
                    <span>Memories ({slots.length})</span>
                  </div>
                  {demoMode ? null : (
                  <div className="sidebar-copy-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={!slot || !baseXml || saving}
                      title="Copy settings from the current memory"
                      onClick={() => setCopyModalOpen(true)}
                    >
                      <Icon name="copy" size={14} />
                      Copy
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={!memoryClipboard || saving}
                      title={
                        memoryClipboard
                          ? `Mass apply: ${memoryClipboard.summary}`
                          : "Copy settings first"
                      }
                      onClick={() => setMassApplyOpen(true)}
                    >
                      <Icon name="paste" size={14} />
                      Mass Apply
                    </button>
                  </div>
                  )}
                  {!demoMode && memoryClipboard ? (
                    <p className="sidebar-clipboard-hint" title={memoryClipboard.summary}>
                      Clipboard: {String(memoryClipboard.sourceSlot).padStart(2, "0")} ·{" "}
                      {memoryClipboard.summary}
                    </p>
                  ) : null}
                  <select
                    className="mem-select"
                    aria-label="Memories"
                    value={slot ?? ""}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (Number.isFinite(next) && next > 0) loadSlot(next, files, { syncPedal: !demoMode });
                    }}
                  >
                    {slot == null ? (
                      <option value="" disabled>
                        Select a memory
                      </option>
                    ) : null}
                    {summaries.map((s) => {
                      const unsaved = (drafts.get(s.slot)?.length ?? 0) > 0;
                      return (
                        <option key={s.slot} value={s.slot}>
                          {unsaved ? "• " : ""}
                          {String(s.slot).padStart(2, "0")} {s.name || "—"} {s.active.toUpperCase()}
                        </option>
                      );
                    })}
                  </select>
                  <div className="mem-list" ref={memListRef}>
                    {summaries.map((s) => {
                      const unsaved = (drafts.get(s.slot)?.length ?? 0) > 0;
                      const canApply =
                        Boolean(memoryClipboard) &&
                        memoryClipboard!.sourceSlot !== s.slot &&
                        !saving;
                      return (
                        <div key={s.slot} className="mem-row" data-slot={s.slot}>
                          <button
                            type="button"
                            className={`mem-item ${slot === s.slot ? "active" : ""} ${unsaved ? "dirty" : ""}`}
                            title={unsaved ? "Unsaved changes" : undefined}
                            aria-label={
                              unsaved
                                ? `Memory ${String(s.slot).padStart(2, "0")} ${s.name || ""}, unsaved changes`
                                : undefined
                            }
                            onClick={() => loadSlot(s.slot, files, { syncPedal: !demoMode })}
                          >
                            <span className="slot">{String(s.slot).padStart(2, "0")}</span>
                            <span className="name">{s.name || "—"}</span>
                            <span className="meta">
                              {unsaved ? <Icon name="dirty" className="mem-dirty" size={10} /> : null}
                              {s.active.toUpperCase()}
                            </span>
                          </button>
                          {canApply ? (
                            <button
                              type="button"
                              className="mem-apply-btn"
                              title={`Apply clipboard: ${memoryClipboard!.summary}`}
                              aria-label={`Apply clipboard to memory ${String(s.slot).padStart(2, "0")}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                requestApply([s.slot]);
                              }}
                            >
                              <Icon name="paste" size={14} />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <div className="memory-editor">
                  <MemoryChainBar
                    model={model}
                    onPatch={pushOps}
                    memoryTab={tab}
                    onJumpTab={(next) => {
                      if ((MEMORY_TABS as readonly string[]).includes(next)) {
                        setTab(next as TabId);
                      }
                    }}
                  />
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

                    {tab === "audio" && model ? (
                      <AudioTab
                        model={model}
                        onPatch={pushOps}
                        dirHandle={hasDirHandle ? dirHandleRef.current : null}
                        canWrite={
                          hasDirHandle && backupAck && (!requireLicense || sessionOk)
                        }
                        writeBlockedReason={
                          !hasDirHandle
                            ? null
                            : requireLicense && !sessionOk
                              ? "Enter a valid license key before writing track audio."
                              : !backupAck
                                ? "Confirm the backup before writing track audio."
                                : null
                        }
                      />
                    ) : null}

                    {tab === "assigns" && model ? (
                      <AssignTab model={model} onPatch={pushOps} />
                    ) : null}

                    {tab === "ctl" && model ? <ControlTab model={model} onPatch={pushOps} /> : null}

                    {tab === "input" && model ? <InputTab model={model} onPatch={pushOps} /> : null}

                    {tab === "output" && model ? (
                      <OutputTab model={model} onPatch={pushOps} />
                    ) : null}

                    {tab === "mixer" && model ? <MixerTab model={model} onPatch={pushOps} /> : null}

                    {tab === "ifx" && model ? (
                      <InputFxTab model={model} onPatch={pushOps} pedalMemories={pedalMemories} />
                    ) : null}

                    {tab === "tfx" && model ? (
                      <TrackFxTab model={model} onPatch={pushOps} />
                    ) : null}

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
      {rhythmConverterMounted ? (
        <div className="modal-backdrop rhythm-converter-modal" role="presentation" hidden={!rhythmConverterOpen}>
          <div className="modal-sheet modal-fullscreen" role="dialog" aria-modal="true" aria-label="Rhythm Converter">
            <div className="modal-head">
              <h2>
                <Icon name="fileMusic" size={16} />
                Rhythm Converter
              </h2>
              <div className="modal-head-actions">
                <button
                  type="button"
                  className="btn ghost modal-close"
                  onClick={closeRhythmConverter}
                  aria-label="Close"
                >
                  <Icon name="close" size={14} />
                  Close
                </button>
              </div>
            </div>
            <div className="modal-body">
              <RhythmConverterTab
                active={rhythmConverterOpen}
                midiLive={Boolean(connected) && !hasDirHandle}
                onPlayNotes={playDrumNotes}
                onSilence={silenceRhythm}
                onRequestMidi={() => void requestMidi(true)}
                onSelectPedalKit={selectPedalRhythmKit}
                dirHandle={hasDirHandle ? dirHandleRef.current : null}
                writeBlockedReason={
                  requireLicense && !sessionOk
                    ? "Enter a valid license key before saving to the RC-600."
                    : !backupAck
                      ? "Confirm the backup before saving to the RC-600."
                      : null
                }
                onUnsavedChange={(pending) => {
                  rhythmConverterUnsavedRef.current = pending;
                }}
                onConnectUsb={() => setUsbConnectOpen(true)}
                onBackupDone={
                  hasDirHandle && !backupAck && !(requireLicense && !sessionOk) ? () => setBackupAck(true) : undefined
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {usbConnectOpen ? (
        <UsbConnectModal onClose={() => setUsbConnectOpen(false)} onOpenFolder={confirmUsbConnect} />
      ) : null}

      {discardAllOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setDiscardAllOpen(false)}
        >
          <div
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-all-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="discard-all-title">Discard all unsaved memory changes?</h2>
            <p>
              This clears pending edits on {dirtySlots.length}{" "}
              {dirtySlots.length === 1 ? "memory" : "memories"}. System settings are not affected.
            </p>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setDiscardAllOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn warn" onClick={discardAll}>
                Discard all
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {copyModalOpen && slot != null ? (
        <MemoryCopyModal
          sourceSlot={slot}
          sourceName={model?.name ?? ""}
          onCancel={() => setCopyModalOpen(false)}
          onConfirm={(selection) => void captureMemoryClipboard(selection)}
        />
      ) : null}

      {massApplyOpen && memoryClipboard ? (
        <MemoryApplyTargetsModal
          memories={summaries.map((s) => ({ slot: s.slot, name: s.name }))}
          sourceSlot={memoryClipboard.sourceSlot}
          summary={memoryClipboard.summary}
          onCancel={() => setMassApplyOpen(false)}
          onConfirm={(targets) => {
            setMassApplyOpen(false);
            requestApply(targets);
          }}
        />
      ) : null}

      {applyConfirm && memoryClipboard ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setApplyConfirm(null)}
        >
          <div
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mem-apply-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mem-apply-confirm-title">Apply clipboard?</h2>
            <p>
              Apply <strong>{memoryClipboard.summary}</strong> from memory{" "}
              {String(memoryClipboard.sourceSlot).padStart(2, "0")} to{" "}
              {applyConfirm.targets.length === 1
                ? `memory ${String(applyConfirm.targets[0]).padStart(2, "0")}`
                : `${applyConfirm.targets.length} memories`}
              . This writes the selected settings on disk.
            </p>
            <div className="mem-copy-switch mem-apply-skip">
              <label htmlFor="mem-apply-skip-confirm" className="mem-copy-switch-label">
                Don&apos;t show this again
              </label>
              <button
                id="mem-apply-skip-confirm"
                type="button"
                role="switch"
                className={`power-switch${applyConfirm.skipChecked ? " on" : ""}`}
                aria-checked={applyConfirm.skipChecked}
                onClick={() =>
                  setApplyConfirm((prev) =>
                    prev ? { ...prev, skipChecked: !prev.skipChecked } : prev,
                  )
                }
              >
                <span className="power-switch-track">
                  <span className="power-switch-thumb" />
                </span>
                <span className="power-switch-state">
                  {applyConfirm.skipChecked ? "ON" : "OFF"}
                </span>
              </button>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setApplyConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!backupAck || saving}
                onClick={() => {
                  if (applyConfirm.skipChecked) saveSkipApplyConfirm(true);
                  const targets = applyConfirm.targets;
                  setApplyConfirm(null);
                  void applyMemoryClipboard(targets);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </DemoModeProvider>
  );
}
