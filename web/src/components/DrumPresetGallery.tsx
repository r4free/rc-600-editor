import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DRUM_PRESET_CATEGORIES,
  groupPresetsByCategory,
  resolveDrumPresetCategory,
  type DrumPresetCategory,
} from "../presets/drumCategories";
import type { DrumPreset, DrumPresetPayload, DrumPresetSource } from "../presets/drumPreset";
import { DEFAULT_KIT_ID, type DrumKit } from "../presets/drumKit";
import { browserPresetRepository } from "../presets/presetRepository";
import { Icon } from "./Icon";

const repo = browserPresetRepository();

export function DrumPresetGallery({
  payload,
  kitId,
  kits,
  onEnsureKit,
  onLoad,
  onBeforeLoad,
  collapsed,
  onCollapsedChange,
}: {
  payload: DrumPresetPayload;
  kitId: string;
  kits: readonly DrumKit[];
  onEnsureKit?: () => Promise<string>;
  onLoad: (preset: DrumPreset) => void;
  onBeforeLoad?: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const [native, setNative] = useState<DrumPreset[]>([]);
  const [user, setUser] = useState<DrumPreset[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DrumPresetCategory>("Rock");
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | DrumPresetCategory>("all");
  const [selected, setSelected] = useState<{ id: string; source: DrumPresetSource } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTarget = useMemo(() => repo.saveTarget(), []);
  const kitNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const kit of kits) map.set(kit.id, kit.name);
    return map;
  }, [kits]);
  const currentKitName = kitNameById.get(kitId) ?? (kitId || DEFAULT_KIT_ID);
  const query = filter.trim().toLowerCase();
  const matchPreset = (preset: DrumPreset) => {
    if (categoryFilter !== "all" && preset.category !== categoryFilter) return false;
    if (!query) return true;
    const kitName = kitNameById.get(preset.kitId) ?? "";
    return (
      preset.name.toLowerCase().includes(query) ||
      preset.category.toLowerCase().includes(query) ||
      kitName.toLowerCase().includes(query) ||
      `${preset.payload.bpm}`.includes(query) ||
      preset.payload.meter.toLowerCase().includes(query)
    );
  };
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
    setCategory(preset.category);
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
      const saved = await repo.save({
        name,
        payload,
        category: resolveDrumPresetCategory(category, name),
        kitId: (await onEnsureKit?.()) || kitId || DEFAULT_KIT_ID,
        id: reuseId,
      });
      await refresh();
      setSelected({ id: saved.id, source: saved.source });
      setName(saved.name);
      setCategory(saved.category);
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
    <div className={`drum-preset-gallery${collapsed ? " is-collapsed" : ""}`}>
      <div className="drum-preset-gallery-head">
        <button
          type="button"
          className="drum-preset-gallery-toggle"
          aria-expanded={!collapsed}
          aria-controls="drum-preset-gallery-body"
          title={collapsed ? "Expand Rhythm gallery" : "Collapse Rhythm gallery"}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <span className="drum-pad-source-label">Rhythm gallery</span>
          <Icon name={collapsed ? "chevronRight" : "chevronDown"} />
        </button>
        {!collapsed ? (
          <>
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
          </>
        ) : null}
      </div>
      <div id="drum-preset-gallery-body" className="drum-preset-gallery-body" hidden={collapsed}>
        <div className="drum-preset-cats" role="tablist" aria-label="Rhythm categories">
          <button
            type="button"
            role="tab"
            className={`drum-preset-cat${categoryFilter === "all" ? " is-on" : ""}`}
            aria-selected={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
          >
            All
          </button>
          {DRUM_PRESET_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              className={`drum-preset-cat${categoryFilter === cat ? " is-on" : ""}`}
              aria-selected={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="drum-preset-cols">
          <PresetColumn
            title={`Factory (${visibleNative.length}${query || categoryFilter !== "all" ? `/${native.length}` : ""})`}
            empty={native.length === 0 ? "No factory rhythms yet." : "No factory rhythms match the filter."}
            presets={visibleNative}
            group={categoryFilter === "all"}
            selectedId={selected?.source === "native" ? selected.id : null}
            kitNameById={kitNameById}
            onSelect={loadPreset}
          />
          <PresetColumn
            title={`My rhythms (${visibleUser.length}${query || categoryFilter !== "all" ? `/${user.length}` : ""})`}
            empty={user.length === 0 ? "No user rhythms saved in this browser." : "No user rhythms match the filter."}
            presets={visibleUser}
            group={categoryFilter === "all"}
            selectedId={selected?.source === "user" ? selected.id : null}
            kitNameById={kitNameById}
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
          <label className="drum-pad-field drum-preset-category-field">
            <span>Category</span>
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as DrumPresetCategory)}
            >
              {DRUM_PRESET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <span className="drum-preset-kit-tag" title="Rhythm is saved with the current kit">
            Kit: {currentKitName}
          </span>
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
    </div>
  );
}

function PresetColumn({
  title,
  empty,
  presets,
  group,
  selectedId,
  kitNameById,
  onSelect,
}: {
  title: string;
  empty: string;
  presets: DrumPreset[];
  group: boolean;
  selectedId: string | null;
  kitNameById: Map<string, string>;
  onSelect: (preset: DrumPreset) => void;
}) {
  const sections = group ? groupPresetsByCategory(presets) : null;
  return (
    <section className="drum-preset-col" aria-label={title}>
      <h3>{title}</h3>
      {presets.length === 0 ? (
        <p className="drum-preset-empty">{empty}</p>
      ) : sections ? (
        <div className="drum-preset-groups">
          {sections.map((section) => (
            <div key={section.category} className="drum-preset-group">
              <h4>{section.category}</h4>
              <PresetChips
                presets={section.presets}
                selectedId={selectedId}
                kitNameById={kitNameById}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      ) : (
        <PresetChips
          presets={presets}
          selectedId={selectedId}
          kitNameById={kitNameById}
          onSelect={onSelect}
        />
      )}
    </section>
  );
}

function PresetChips({
  presets,
  selectedId,
  kitNameById,
  onSelect,
}: {
  presets: DrumPreset[];
  selectedId: string | null;
  kitNameById: Map<string, string>;
  onSelect: (preset: DrumPreset) => void;
}) {
  return (
    <div className="drum-preset-chips">
      {presets.map((preset) => {
        const kitName = kitNameById.get(preset.kitId);
        return (
          <button
            key={`${preset.source}-${preset.id}`}
            type="button"
            className={`drum-preset-chip${selectedId === preset.id ? " is-on" : ""}`}
            aria-pressed={selectedId === preset.id}
            title={`${preset.name} · ${kitName ?? preset.kitId} · ${preset.category} · ${preset.payload.bpm} BPM ${preset.payload.meter}`}
            onClick={() => onSelect(preset)}
          >
            <span>{preset.name}</span>
            <span className="drum-preset-chip-meta">
              {kitName ? `${kitName} · ` : ""}
              {preset.payload.bpm} · {preset.payload.meter}
            </span>
          </button>
        );
      })}
    </div>
  );
}
