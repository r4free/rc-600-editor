import { useCallback, useEffect, useMemo, useState } from "react";
import { MAX_PAD_COUNT, MIN_PAD_COUNT, clampPadCount } from "../drumMap";
import type { DrumKit, DrumKitSource } from "../presets/drumKit";
import { browserKitRepository } from "../presets/kitRepository";
import { Icon } from "./Icon";

const repo = browserKitRepository();

const PAD_COUNT_OPTIONS = Array.from(
  { length: MAX_PAD_COUNT - MIN_PAD_COUNT + 1 },
  (_, i) => i + MIN_PAD_COUNT,
);

export function DrumKitGallery({
  kit,
  selectedId,
  revision,
  collapsed,
  onCollapsedChange,
  onLoad,
  onBeforeLoad,
  onPadCountChange,
  onSaved,
}: {
  kit: { name: string; padCount: number; notes: readonly number[] };
  selectedId: string | null;
  revision: number;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onLoad: (kit: DrumKit) => void;
  onBeforeLoad?: () => void;
  onPadCountChange: (padCount: number) => void;
  onSaved?: (kit: DrumKit) => void;
}) {
  const [native, setNative] = useState<DrumKit[]>([]);
  const [user, setUser] = useState<DrumKit[]>([]);
  const [name, setName] = useState(kit.name);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<{ id: string; source: DrumKitSource } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTarget = useMemo(() => repo.saveTarget(), []);
  const query = filter.trim().toLowerCase();
  const matchKit = (item: DrumKit) => {
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      `${item.padCount}`.includes(query) ||
      `${item.padCount} pads`.includes(query)
    );
  };
  const visibleNative = native.filter(matchKit);
  const visibleUser = user.filter(matchKit);

  const refresh = useCallback(async () => {
    const listed = await repo.list();
    setNative(listed.native);
    setUser(listed.user);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, revision]);

  useEffect(() => {
    const found = [...native, ...user].find((item) => item.id === selectedId);
    if (found) {
      setSelected({ id: found.id, source: found.source });
      setName(found.name);
      return;
    }
    setName(kit.name);
  }, [selectedId, native, user, kit.name]);

  async function loadKit(item: DrumKit) {
    onBeforeLoad?.();
    setSelected({ id: item.id, source: item.source });
    setName(item.name);
    onLoad(item);
    setStatus(`Loaded ${item.source === "native" ? "Factory" : "My kits"}: ${item.name}`);
  }

  async function saveCurrent() {
    setBusy(true);
    setStatus(null);
    try {
      const selectedKit = [...native, ...user].find(
        (item) => selected && item.id === selected.id && item.source === selected.source,
      );
      const sameName =
        selectedKit != null && selectedKit.name.toLowerCase() === name.trim().toLowerCase();
      const reuseId =
        selected && selected.source === saveTarget && sameName ? selected.id : undefined;
      const saved = await repo.save({
        name,
        padCount: kit.padCount,
        notes: kit.notes,
        id: reuseId,
      });
      await refresh();
      setSelected({ id: saved.id, source: saved.source });
      setName(saved.name);
      onSaved?.(saved);
      setStatus(
        saveTarget === "native"
          ? `Saved to Factory library (${saved.name}, ${saved.padCount} pads)`
          : `Saved to My kits (${saved.name}, ${saved.padCount} pads)`,
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
      setStatus(`Deleted ${selected.source === "native" ? "Factory" : "My kits"} kit`);
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
          aria-controls="drum-kit-gallery-body"
          title={collapsed ? "Expand Kit gallery" : "Collapse Kit gallery"}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <span className="drum-pad-source-label">Kit gallery</span>
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
                aria-label="Filter kits"
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <span className="drum-preset-gallery-hint">
              Kits set pad count and which instruments appear. A saved rhythm keeps its kit.
            </span>
          </>
        ) : null}
      </div>
      <div id="drum-kit-gallery-body" className="drum-preset-gallery-body" hidden={collapsed}>
        <div className="drum-preset-cols">
          <KitColumn
            title={`Factory (${visibleNative.length}${query ? `/${native.length}` : ""})`}
            empty={native.length === 0 ? "No factory kits yet." : "No factory kits match the filter."}
            kits={visibleNative}
            selectedId={selectedId}
            onSelect={loadKit}
          />
          <KitColumn
            title={`My kits (${visibleUser.length}${query ? `/${user.length}` : ""})`}
            empty={user.length === 0 ? "No user kits saved in this browser." : "No user kits match the filter."}
            kits={visibleUser}
            selectedId={selectedId}
            onSelect={loadKit}
          />
        </div>
        <div className="drum-preset-save-row">
          <label className="drum-pad-field drum-preset-name-field">
            <span>Name</span>
            <input
              type="text"
              maxLength={48}
              value={name}
              placeholder="Kit name"
              aria-label="Kit name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="drum-pad-field drum-preset-pads-field">
            <span>Pads</span>
            <select
              aria-label="Pad count"
              value={kit.padCount}
              onChange={(e) => onPadCountChange(clampPadCount(Number(e.target.value)))}
            >
              {PAD_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" disabled={busy} onClick={() => void saveCurrent()}>
            <Icon name="save" />
            Save kit
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

function KitColumn({
  title,
  empty,
  kits,
  selectedId,
  onSelect,
}: {
  title: string;
  empty: string;
  kits: DrumKit[];
  selectedId: string | null;
  onSelect: (kit: DrumKit) => void;
}) {
  return (
    <section className="drum-preset-col" aria-label={title}>
      <h3>{title}</h3>
      {kits.length === 0 ? (
        <p className="drum-preset-empty">{empty}</p>
      ) : (
        <div className="drum-preset-chips">
          {kits.map((item) => (
            <button
              key={`${item.source}-${item.id}`}
              type="button"
              className={`drum-preset-chip${selectedId === item.id ? " is-on" : ""}`}
              aria-pressed={selectedId === item.id}
              title={`${item.name} · ${item.padCount} pads`}
              onClick={() => onSelect(item)}
            >
              <span>{item.name}</span>
              <span className="drum-preset-chip-meta">
                {item.padCount} {item.padCount === 1 ? "pad" : "pads"}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
