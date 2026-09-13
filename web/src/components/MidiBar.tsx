import type { MidiEnvironment, MidiPortInfo } from "@rc600/midi/rc600-midi";

interface Props {
  env: MidiEnvironment;
  outputs: MidiPortInfo[];
  selectedOutId: string | null;
  connectedName: string | null;
  busy: boolean;
  hasAccess: boolean;
  onRequestAccess: () => void;
  onSelectOut: (id: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  channel: number;
  onChannel: (ch: number) => void;
  onProgram: (slot: number) => void;
  onStart: () => void;
  onStop: () => void;
  currentSlot: number | null;
  onCc: (cc: number, value: number) => void;
}

export function MidiBar({
  env,
  outputs,
  selectedOutId,
  connectedName,
  busy,
  hasAccess,
  onRequestAccess,
  onSelectOut,
  onConnect,
  onDisconnect,
  onRefresh,
  channel,
  onChannel,
  onProgram,
  onStart,
  onStop,
  currentSlot,
  onCc,
}: Props) {
  if (!env.supported) {
    return (
      <div className="midi-bar">
        <span className="hint">{env.help}</span>
      </div>
    );
  }

  return (
    <div className="midi-bar">
      {!hasAccess ? (
        <button type="button" className="btn primary" disabled={busy} onClick={onRequestAccess}>
          {busy ? "MIDI…" : "Allow MIDI"}
        </button>
      ) : (
        <>
          <select
            value={selectedOutId ?? ""}
            onChange={(e) => onSelectOut(e.target.value)}
            aria-label="MIDI OUT"
          >
            <option value="">MIDI OUT…</option>
            {outputs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="hint">
            Ch{" "}
            <select value={channel} onChange={(e) => onChannel(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          {connectedName ? (
            <button type="button" className="btn ghost" onClick={onDisconnect}>
              Disconnect ({connectedName})
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={!selectedOutId || busy} onClick={onConnect}>
              Connect
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onRefresh}>
            Refresh
          </button>
        </>
      )}

      <div className="live-dock">
        <button
          type="button"
          className="btn"
          disabled={!connectedName || !currentSlot}
          onClick={() => currentSlot && onProgram(currentSlot)}
        >
          PC mem {currentSlot ?? "—"}
        </button>
        <button type="button" className="btn" disabled={!connectedName} onClick={onStart}>
          Start
        </button>
        <button type="button" className="btn" disabled={!connectedName} onClick={onStop}>
          Stop
        </button>
        <button type="button" className="btn" disabled={!connectedName} onClick={() => onCc(1, 127)}>
          CC1
        </button>
        <button type="button" className="btn" disabled={!connectedName} onClick={() => onCc(64, 127)}>
          CC64
        </button>
      </div>
      <span className="hint">
        USB MIDI needs STORAGE OFF. Play Drum notes use Rx Rhythm CH (factory 10), not the CTL Ch
        here.
      </span>
    </div>
  );
}
