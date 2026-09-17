/** Web MIDI helpers for RC-600 (PC / CC / transport — no SysEx param map). */

/** App Store listing for the iOS browser that exposes Web MIDI. */
export const IOS_WEB_MIDI_BROWSER_URL =
  "https://apps.apple.com/app/web-midi-browser/id953846217";

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export type MidiBlockReason = "ok" | "insecure" | "ios" | "ide" | "unavailable";

export interface MidiEnvironment {
  supported: boolean;
  secureContext: boolean;
  isIOS: boolean;
  isIdePreview: boolean;
  blockReason: MidiBlockReason;
  help: string;
}

function portInfo(p: MIDIPort): MidiPortInfo {
  return {
    id: p.id,
    name: p.name ?? p.id,
    manufacturer: p.manufacturer ?? "",
  };
}

export function isIdePreviewBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  if (/Electron|Cursor\/|VSCode|Code\/\d/i.test(ua)) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return false;
}

export function midiEnvironment(): MidiEnvironment {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIdePreview = isIdePreviewBrowser();
  const secureContext = typeof window === "undefined" ? true : window.isSecureContext;
  const hasApi = typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";

  let blockReason: MidiBlockReason = "ok";
  if (isIOS && !hasApi) blockReason = "ios";
  else if (isIdePreview) blockReason = "ide";
  else if (!secureContext) blockReason = "insecure";
  else if (!hasApi) blockReason = "unavailable";

  const help =
    blockReason === "ios"
      ? "Safari and Chrome on iPhone/iPad have no Web MIDI. Open this site in Web MIDI Browser, or use a computer."
      : blockReason === "ide"
        ? "The Cursor preview does not allow MIDI. Open http://127.0.0.1:5190 in Chrome or Edge."
        : blockReason === "insecure"
          ? "Web MIDI needs HTTPS (or localhost)."
          : blockReason === "unavailable"
            ? "This browser has no Web MIDI. Use Chrome or Edge."
            : "Allow MIDI, choose the RC-600 port, then Connect.";

  return {
    supported: hasApi && secureContext && !isIdePreview,
    secureContext,
    isIOS,
    isIdePreview,
    blockReason,
    help,
  };
}

export function isLikelyRc600(name: string): boolean {
  return /rc[\s-]?600/i.test(name);
}

/** Windows lists a second DAW port (MIDIIN2 / MIDIOUT2) that often ignores notes. */
export function isSecondaryUsbMidiPort(name: string): boolean {
  const s = name.toLowerCase();
  return /midiin\s*2|midiout\s*2|midi\s*in\s*2|midi\s*out\s*2|\bport\s*2\b|midi\s*2/.test(s);
}

export function isLoopbackMidiPort(name: string): boolean {
  const s = name.toLowerCase();
  return /loopmidi|loopbe|loopback|midi yoke|\biac\b|virtual midi/.test(s);
}

/** Lower is better. Prefer the main RC-600 USB port over MIDIOUT2 / loopback. */
export function rc600PortRank(name: string): number {
  if (isLoopbackMidiPort(name)) return 90;
  if (isLikelyRc600(name)) return isSecondaryUsbMidiPort(name) ? 5 : 0;
  if (/boss|roland/i.test(name)) return 20;
  return 50;
}

export function preferRc600Output(ports: readonly MidiPortInfo[]): MidiPortInfo | undefined {
  if (!ports.length) return undefined;
  return [...ports].sort((a, b) => rc600PortRank(a.name) - rc600PortRank(b.name))[0];
}

export type MidiPermissionState = PermissionState | "unknown";

/** Chrome/Edge remember MIDI per origin; query so we can skip the Allow button. */
export async function queryMidiPermission(sysex = false): Promise<MidiPermissionState> {
  const permissions = typeof navigator !== "undefined" ? navigator.permissions : undefined;
  if (!permissions?.query) return "unknown";
  try {
    const status = await permissions.query({ name: "midi", sysex } as PermissionDescriptor);
    return status.state;
  } catch {
    try {
      const status = await permissions.query({ name: "midi" } as PermissionDescriptor);
      return status.state;
    } catch {
      return "unknown";
    }
  }
}

export function shouldReuseMidiAccess(
  permission: MidiPermissionState,
  previouslyAllowed: boolean,
): boolean {
  return permission === "granted" || (permission === "unknown" && previouslyAllowed);
}

/** Neighbor slot used to force a memory reload (same-slot PC is often ignored). */
export function adjacentMemorySlot(slot: number): number {
  const n = Math.max(1, Math.min(99, Math.round(slot)));
  return n <= 1 ? 2 : n - 1;
}

/**
 * USB Storage and USB MIDI are exclusive. A Program Change sent while the
 * ROLAND folder is still open is ignored, and the live kit stays unchanged.
 */
export function shouldReloadSavedMemory(opts: {
  midiConnected: boolean;
  usbStorageOpen: boolean;
}): boolean {
  return opts.midiConnected && !opts.usbStorageOpen;
}

/** Editor memory clicks should follow the pedal over USB MIDI, not while Storage is open. */
export function shouldSyncPedalOnMemorySelect(opts: {
  midiConnected: boolean;
  usbStorageOpen?: boolean;
}): boolean {
  return opts.midiConnected && !opts.usbStorageOpen;
}

/** Memory 1–99 from a Program Change on Rx CTL CH (or any listen channel), or null. */
export function parseCtlProgramChange(
  data: ArrayLike<number> | null | undefined,
  ctlChannel: number | readonly number[],
): number | null {
  if (!data || data.length < 2) return null;
  const status = data[0]!;
  if ((status & 0xf0) !== 0xc0) return null;
  const ch = status & 0x0f;
  const allowed = (typeof ctlChannel === "number" ? [ctlChannel] : ctlChannel).map((c) => c & 0x0f);
  if (!allowed.includes(ch)) return null;
  return (data[1]! & 0x7f) + 1;
}

/**
 * Channels to send Program Change, kit CC, and Play Drum notes on.
 * Pads use Rx Rhythm CH; memory/kit follow Rx CTL CH. Include every channel
 * the pedal might be listening on (bar + SYSTEM tags) so a single-channel
 * setup like Rx 3 still gets memory recalls.
 */
export function midiSendChannels(...channels: number[]): number[] {
  const out: number[] = [];
  for (const raw of channels) {
    if (!Number.isFinite(raw)) continue;
    const ch = Math.max(0, Math.min(15, raw | 0));
    if (!out.includes(ch)) out.push(ch);
  }
  return out.length ? out : [0];
}

/** Wait after the bounce PC so the pedal can finish loading the other memory. */
export const MEMORY_RELOAD_SETTLE_MS = 400;
/** Wait after eject so DISCONNECTING can finish before the first PC. */
export const USB_MIDI_SETTLE_MS = 1600;

const MIDI_PREFS_KEY = "rc600.midi.prefs";

export interface MidiSessionPrefs {
  allowed: boolean;
  outId: string | null;
  channel: number;
  /** 0-based channel for Play Drum note messages. Factory Rx Rhythm CH is 10. */
  rhythmChannel: number;
}

export function initialMidiChannel(
  prefs: Pick<MidiSessionPrefs, "channel" | "rhythmChannel">,
): number {
  if (prefs.channel !== 0) return prefs.channel;
  if (prefs.rhythmChannel !== 9) return prefs.rhythmChannel;
  return 0;
}

const DEFAULT_MIDI_PREFS: MidiSessionPrefs = {
  allowed: false,
  outId: null,
  channel: 0,
  rhythmChannel: 9,
};

export function loadMidiPrefs(): MidiSessionPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_MIDI_PREFS };
  try {
    const raw = localStorage.getItem(MIDI_PREFS_KEY);
    if (!raw) return { ...DEFAULT_MIDI_PREFS };
    const parsed = JSON.parse(raw) as Partial<MidiSessionPrefs>;
    const channel = parsed.channel;
    const rhythmChannel = parsed.rhythmChannel;
    return {
      allowed: parsed.allowed === true,
      outId: typeof parsed.outId === "string" && parsed.outId ? parsed.outId : null,
      channel:
        typeof channel === "number" && Number.isInteger(channel) && channel >= 0 && channel <= 15
          ? channel
          : 0,
      rhythmChannel:
        typeof rhythmChannel === "number" &&
        Number.isInteger(rhythmChannel) &&
        rhythmChannel >= 0 &&
        rhythmChannel <= 15
          ? rhythmChannel
          : 9,
    };
  } catch {
    return { ...DEFAULT_MIDI_PREFS };
  }
}

export function saveMidiPrefs(patch: Partial<MidiSessionPrefs>): MidiSessionPrefs {
  const next = { ...loadMidiPrefs(), ...patch };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(MIDI_PREFS_KEY, JSON.stringify(next));
  }
  return next;
}

export class Rc600Midi {
  private access: MIDIAccess | null = null;
  private out: MIDIOutput | null = null;
  channel = 0; // 0-based Rx CTL CH
  /** Extra channels for PC / kit CC / incoming PC (Rx Rhythm CH when it differs). */
  listenChannels: number[] = [];
  onStateChange: ((ports: { outputs: MidiPortInfo[]; inputs: MidiPortInfo[] }) => void) | null =
    null;
  onIncomingProgramChange: ((slot: number) => void) | null = null;

  async requestAccess(): Promise<{ outputs: MidiPortInfo[]; inputs: MidiPortInfo[] }> {
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => {
      this.armInputs();
      this.onStateChange?.(this.listPorts());
    };
    this.armInputs();
    return this.listPorts();
  }

  listPorts(): { outputs: MidiPortInfo[]; inputs: MidiPortInfo[] } {
    const outputs: MidiPortInfo[] = [];
    const inputs: MidiPortInfo[] = [];
    if (!this.access) return { outputs, inputs };
    this.access.outputs.forEach((p) => outputs.push(portInfo(p)));
    this.access.inputs.forEach((p) => inputs.push(portInfo(p)));
    return { outputs, inputs };
  }

  connect(outputId: string): boolean {
    if (!this.access) return false;
    const out = this.access.outputs.get(outputId);
    if (!out) return false;
    this.out = out;
    this.armInputs();
    void this.armOutputs();
    return true;
  }

  disconnect(): void {
    this.out = null;
  }

  get connectedName(): string | null {
    return this.out?.name ?? null;
  }

  /** Linked OUT plus every other RC-600 USB port (Windows often has two). */
  private noteOutputs(): MIDIOutput[] {
    const seen = new Set<string>();
    const outs: MIDIOutput[] = [];
    const add = (o: MIDIOutput | null | undefined) => {
      if (!o || seen.has(o.id)) return;
      seen.add(o.id);
      outs.push(o);
    };
    add(this.out);
    if (this.access) {
      this.access.outputs.forEach((p) => {
        if (isLikelyRc600(p.name ?? "")) add(p);
      });
    }
    return outs;
  }

  private armInputs(): void {
    if (!this.access) return;
    this.access.inputs.forEach((p) => {
      p.onmidimessage = (ev) => {
        const slot = parseCtlProgramChange(ev.data, [this.channel, ...this.listenChannels]);
        if (slot != null) this.onIncomingProgramChange?.(slot);
      };
    });
  }

  private async armOutputs(): Promise<void> {
    for (const out of this.noteOutputs()) {
      if (out.connection !== "open" && typeof out.open === "function") {
        try {
          await out.open();
        } catch {
          /* browser may already own the port */
        }
      }
    }
  }

  private sendTo(out: MIDIOutput, data: Uint8Array, timestamp?: number): void {
    try {
      if (timestamp != null) out.send(data, timestamp);
      else out.send(data);
    } catch {
      if (typeof out.open === "function") {
        void out.open()
          .then(() => {
            if (timestamp != null) out.send(data, timestamp);
            else out.send(data);
          })
          .catch(() => {
            /* closed / exclusive */
          });
      }
    }
  }

  private send(bytes: number[], allRc600 = false, timestamp?: number): void {
    const targets = allRc600 ? this.noteOutputs() : this.out ? [this.out] : [];
    for (const out of targets) this.sendTo(out, new Uint8Array(bytes), timestamp);
  }

  private ctlChannels(extra?: readonly number[]): number[] {
    const raw = extra?.length ? extra : [this.channel, ...this.listenChannels];
    return [...new Set(raw.map((c) => c & 0x0f))];
  }

  /** Program Change: memory 1–99 → PC 0–98. Broadcast to every RC-600 USB port. */
  programChange(memorySlot: number, timestamp?: number, channel = this.channel): void {
    const pc = Math.max(1, Math.min(99, memorySlot)) - 1;
    this.send([0xc0 | (channel & 0x0f), pc], true, timestamp);
  }

  /**
   * Same-slot PC often leaves the current kit in RAM. Switch away, then back,
   * so the pedal reloads the saved memory (including Rhythm Kit).
   */
  reloadMemory(memorySlot: number, channels?: readonly number[]): void {
    const target = Math.max(1, Math.min(99, memorySlot));
    const neighbor = adjacentMemorySlot(target);
    const chans = this.ctlChannels(channels);
    for (const ch of chans) this.programChange(neighbor, undefined, ch);
    const when =
      typeof performance !== "undefined" ? performance.now() + MEMORY_RELOAD_SETTLE_MS : undefined;
    for (const ch of chans) this.programChange(target, when, ch);
  }

  controlChange(cc: number, value: number, allRc600 = false, channels?: readonly number[]): void {
    const chans = this.ctlChannels(channels);
    for (const ch of chans) {
      this.send([0xb0 | ch, cc & 0x7f, value & 0x7f], allRc600 || chans.length > 1);
    }
  }

  start(): void {
    this.send([0xfa]);
  }

  stop(): void {
    this.send([0xfc]);
  }

  continue(): void {
    this.send([0xfb]);
  }

  /** Send one MIDI clock tick (0xF8). Caller owns tempo timing. */
  clock(): void {
    this.send([0xf8]);
  }

  noteOn(note: number, velocity: number, channel = this.channel): void {
    const ch = channel & 0x0f;
    const n = note & 0x7f;
    const v = Math.max(1, velocity & 0x7f);
    this.send([0x90 | ch, n, v], true);
  }

  noteOff(note: number, channel = this.channel): void {
    const ch = channel & 0x0f;
    const n = note & 0x7f;
    this.send([0x80 | ch, n, 0], true);
    this.send([0x90 | ch, n, 0], true);
  }

  allNotesOff(channel = this.channel): void {
    const ch = channel & 0x0f;
    /* CC 120 All Sound Off can stop the RC-600 rhythm engine — only notes off. */
    this.send([0xb0 | ch, 123, 0], true);
  }
}
