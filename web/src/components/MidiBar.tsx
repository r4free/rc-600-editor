import type { MidiEnvironment, MidiPortInfo } from "@rc600/midi/rc600-midi";

interface Props {
  env: MidiEnvironment;
  outputs: MidiPortInfo[];
  selectedOutId: string | null;
  busy: boolean;
  hasAccess: boolean;
  onRequestAccess: () => void;
  onSelectOut: (id: string) => void;
  channel: number;
  onChannel: (ch: number) => void;
}

export function MidiBar({
  env,
  outputs,
  selectedOutId,
  busy,
  hasAccess,
  onRequestAccess,
  onSelectOut,
  channel,
  onChannel,
}: Props) {
  if (!env.supported) {
    return (
      <div className="midi-bar" aria-label="USB MIDI connection">
        <span className="midi-hint">{env.help}</span>
      </div>
    );
  }

  return (
    <div className="midi-bar" aria-label="USB MIDI connection">
      {!hasAccess ? (
        <button type="button" className="btn primary" disabled={busy} onClick={onRequestAccess}>
          {busy ? "MIDI…" : "Allow MIDI"}
        </button>
      ) : (
        <>
          <select
            className="midi-select"
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
          <label className="midi-port">
            <span>Rx CH</span>
            <select
              className="midi-select midi-ch"
              value={channel}
              aria-label="Rx CH"
              onChange={(e) => onChannel(Number(e.target.value))}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
