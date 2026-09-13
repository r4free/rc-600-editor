import { useCallback, useEffect, useMemo, useState } from "react";
import type { DrumPreset, DrumPresetPayload, DrumPresetSource } from "../presets/drumPreset";
import { browserPresetRepository } from "../presets/presetRepository";
import { Icon } from "./Icon";

const repo = browserPresetRepository();

export function DrumPresetGallery({
  payload,
  onLoad,
  onBeforeLoad,
}: {
  payload: DrumPresetPayload;
  onLoad: (preset: DrumPreset) => void;
  onBeforeLoad?: () => void;
}) {
  const [native, setNative] = useState<DrumPreset[]>([]);
  const [user, setUser] = useState<DrumPreset[]>([]);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<{ id: string; source: DrumPresetSource } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTarget = useMemo(() => repo.saveTarget(), []);
  const query = filter.trim().toLowerCase();
  const matchPreset = (preset: DrumPreset) =>
    !query ||
    preset.name.toLowerCase().includes(query) ||
    `${preset.payload.bpm}`.includes(query) ||
    preset.payload.meter.toLowerCase().includes(query);
  const visibleNative = native.filter(matchPreset);
  const visibleUser = user.filter(matchPreset);

  const refresh = useCallback(async () => {
    const listed = await repo.list();
    setNative(listed.native);
    setUser(listed.user);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadPreset(preset: DrumPreset) {
    onBeforeLoad?.();
    setSelected({ id: preset.id, source: preset.source });
    setName(preset.name);
    onLoad(preset);
    setStatus(`Loaded ${preset.source === "native" ? "Factory" : "My rhythms"}: ${preset.name}`);
  }

  async function saveCurrent() {
    setBusy(true);
    setStatus(null);
    try {
      const selectedPreset = [...native, ...user].find(
        (p) => selected && p.id === selected.id && p.source === selected.source,
      );
      const sameName =
        selectedPreset != null &&
        selectedPreset.name.toLowerCase() === name.trim().toLowerCase();
      const reuseId =
        selected && selected.source === saveTarget && sameName ? selected.id : undefined;
      const saved = await repo.save({ name, payload, id: reuseId });
      await refresh();
      setSelected({ id: saved.id, source: saved.source });
      setName(saved.name);
      setStatus(
        saveTarget === "native"
          ? `Saved to Factory library (${saved.name})`
          : `Saved to My rhythms (${saved.name})`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (selected.source === "native" && saveTarget !== "native") return;
    setBusy(true);
    setStatus(null);
    try {
      await repo.remove(selected.id, selected.source);
      await refresh();
      setSelected(null);
      setStatus(`Deleted ${selected.source === "native" ? "Factory" : "My rhythms"} rhythm`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const canDelete =
    selected != null && (selected.source === "user" || saveTarget === "native");

  return (
    <div className="drum-preset-gallery">
      <div className="drum-preset-gallery-head">
        <span className="drum-pad-source-label">Rhythm gallery</span>
        <label className="drum-pad-field drum-preset-filter">
          <Icon name="search" />
          <input
            type="search"
            value={filter}
            placeholder="Filter"
            aria-label="Filter rhythms"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <span className="drum-preset-gallery-hint">
          {saveTarget === "native"
            ? "Development: Save writes the Factory JSON library."
            : "Production: Save writes My rhythms in this browser."}
        </span>
      </div>
      <div className="drum-preset-cols">
        <PresetColumn
          title={`Factory (${visibleNative.length}${query ? `/${native.length}` : ""})`}
          empty={native.length === 0 ? "No factory rhythms yet." : "No factory rhythms match the filter."}
          presets={visibleNative}
          selectedId={selected?.source === "native" ? selected.id : null}
          onSelect={loadPreset}
        />
        <PresetColumn
          title={`My rhythms (${visibleUser.length}${query ? `/${user.length}` : ""})`}
          empty={user.length === 0 ? "No user rhythms saved in this browser." : "No user rhythms match the filter."}
          presets={visibleUser}
          selectedId={selected?.source === "user" ? selected.id : null}
          onSelect={loadPreset}
        />
      </div>
      <div className="drum-preset-save-row">
        <label className="drum-pad-field drum-preset-name-field">
          <span>Name</span>
          <input
            type="text"
            maxLength={48}
            value={name}
            placeholder="Rhythm name"
            aria-label="Rhythm name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="button" className="btn" disabled={busy} onClick={() => void saveCurrent()}>
          <Icon name="save" />
          Save
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy || !canDelete}
          onClick={() => void deleteSelected()}
        >
          <Icon name="close" />
          Delete
        </button>
        {status ? <span className="drum-preset-status">{status}</span> : null}
      </div>
    </div>
  );
}

function PresetColumn({
  title,
  empty,
  presets,
  selectedId,
  onSelect,
}: {
  title: string;
  empty: string;
  presets: DrumPreset[];
  selectedId: string | null;
  onSelect: (preset: DrumPreset) => void;
}) {
  return (
    <section className="drum-preset-col" aria-label={title}>
      <h3>{title}</h3>
      {presets.length === 0 ? (
        <p className="drum-preset-empty">{empty}</p>
      ) : (
        <div className="drum-preset-chips">
          {presets.map((preset) => (
            <button
              key={`${preset.source}-${preset.id}`}
              type="button"
              className={`drum-preset-chip${selectedId === preset.id ? " is-on" : ""}`}
              aria-pressed={selectedId === preset.id}
              title={`${preset.name} · ${preset.payload.bpm} BPM ${preset.payload.meter}`}
              onClick={() => onSelect(preset)}
            >
              <span>{preset.name}</span>
              <span className="drum-preset-chip-meta">
                {preset.payload.bpm} · {preset.payload.meter}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
