/** Web MIDI helpers for RC-600 (PC / CC / transport — no SysEx param map). */

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
  if (isIOS) blockReason = "ios";
  else if (isIdePreview) blockReason = "ide";
  else if (!secureContext) blockReason = "insecure";
  else if (!hasApi) blockReason = "unavailable";

  const help =
    blockReason === "ios"
      ? "Chrome no iPhone/iPad não tem Web MIDI. Use um computador (Chrome/Edge)."
      : blockReason === "ide"
        ? "O preview do Cursor não libera MIDI. Abra http://127.0.0.1:5190 no Chrome ou Edge."
        : blockReason === "insecure"
          ? "Web MIDI precisa de HTTPS (ou localhost)."
          : blockReason === "unavailable"
            ? "Este navegador não tem Web MIDI. Use Chrome ou Edge."
            : "Allow MIDI, escolha a porta RC-600 e Connect.";

  return {
    supported: hasApi && secureContext && !isIOS && !isIdePreview,
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

export class Rc600Midi {
  private access: MIDIAccess | null = null;
  private out: MIDIOutput | null = null;
  channel = 0; // 0-based

  async requestAccess(): Promise<{ outputs: MidiPortInfo[]; inputs: MidiPortInfo[] }> {
    this.access = await navigator.requestMIDIAccess({ sysex: false });
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
    return true;
  }

  disconnect(): void {
    this.out = null;
  }

  get connectedName(): string | null {
    return this.out?.name ?? null;
  }

  private send(bytes: number[]): void {
    this.out?.send(bytes);
  }

  /** Program Change: memory 1–99 → PC 0–98 */
  programChange(memorySlot: number): void {
    const pc = Math.max(1, Math.min(99, memorySlot)) - 1;
    this.send([0xc0 | (this.channel & 0x0f), pc]);
  }

  controlChange(cc: number, value: number): void {
    this.send([0xb0 | (this.channel & 0x0f), cc & 0x7f, value & 0x7f]);
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
}
