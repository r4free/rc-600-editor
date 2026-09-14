import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { MemoryModel } from "@rc600/rc0/memory";
import { fxSlotSection } from "@rc600/catalog/params";
import { readUiTab, saveUiTab, usePersistedTab } from "../uiTabs";
import { Icon } from "./Icon";
import type { PatchHandler } from "./LoopTab";
import { chainFocusFor } from "./chainFocus";
import {
  NODE,
  buildMemoryFlowGraph,
  memoryEdgePath,
  type MemoryFlowNode,
  type MemoryToggle,
} from "./memoryChainModel";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const PAN_THRESHOLD = 4;

const CHAIN_VIS = ["off", "on"] as const;
const ZOOM_PRESETS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
}

function snapZoom(z: number): (typeof ZOOM_PRESETS)[number] {
  const next = clampZoom(z);
  let best: (typeof ZOOM_PRESETS)[number] = 1;
  let bestDist = Infinity;
  for (const preset of ZOOM_PRESETS) {
    const d = Math.abs(preset - next);
    if (d < bestDist) {
      bestDist = d;
      best = preset;
    }
  }
  return best;
}

function bankFromSection(section: string): number {
  const c = section.charCodeAt(0);
  if (c >= 65 && c <= 68) return c - 65;
  return 0;
}

function slotFromSection(section: string): number {
  const c = section.charCodeAt(1);
  if (c >= 65 && c <= 68) return c - 65;
  return 0;
}

function laneWireClass(lane: string): string {
  if (lane === "send" || lane === "serial") return lane;
  if (lane.startsWith("in-")) return "p1";
  if (lane.startsWith("trk-")) {
    const n = Number(lane.slice(4)) || 1;
    return `p${((n - 1) % 4) + 1}`;
  }
  if (lane === "rhythm") return "pr";
  return "serial";
}

function FlowBlock({
  node,
  selected,
  onSelect,
  onToggle,
}: {
  node: MemoryFlowNode;
  selected: boolean;
  onSelect: () => void;
  onToggle?: () => void;
}) {
  const on = node.toggle ? Boolean(node.toggleOn) : true;
  const style: CSSProperties = {
    left: node.x,
    top: node.y,
    width: NODE,
    height: NODE,
    zIndex: selected ? 5 : 2,
    opacity: node.inactive ? 0.42 : 1,
  };

  return (
    <div
      className={[
        "boss-node",
        `boss-node--${node.shape}`,
        `boss-node--${node.tone}`,
        on ? "is-on" : "is-off",
        selected ? "is-selected" : "",
        node.inactive ? "is-path-off" : "",
        node.muted ? "is-muted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {node.muted ? (
        <span className="boss-node-mute-badge" title="Muted" aria-hidden>
          M
        </span>
      ) : null}
      <button type="button" className="boss-node-hit" onClick={onSelect}>
        <span className="boss-node-label">{node.label}</span>
        {node.sublabel ? <span className="boss-node-sub">{node.sublabel}</span> : null}
      </button>
      {onToggle ? (
        <button
          type="button"
          className="boss-node-sw"
          title={on ? "Bypass" : "Enable"}
          aria-label={`Toggle ${node.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      ) : null}
    </div>
  );
}

function applyToggle(model: MemoryModel, toggle: MemoryToggle, onPatch: PatchHandler) {
  if (toggle.kind === "mixer") {
    const cur = Number.parseInt(model.mixer[toggle.tag] ?? "0", 10) || 0;
    onPatch({ type: "section", section: "MIXER", tags: { [toggle.tag]: cur ? "0" : "1" } });
    return;
  }
  if (toggle.kind === "track") {
    const tags = model.tracks[toggle.track - 1] ?? {};
    const cur = Number.parseInt(tags[toggle.tag] ?? "0", 10) || 0;
    onPatch({
      type: "track",
      track: toggle.track,
      tags: { [toggle.tag]: cur ? "0" : "1" },
    });
    return;
  }
  if (toggle.kind === "ifx") {
    const bank = bankFromSection(toggle.section);
    const slot = slotFromSection(toggle.section);
    const cur = Number.parseInt(model.ifxSlots[bank]?.[slot]?.[toggle.tag] ?? "0", 10) || 0;
    onPatch({
      type: "ifx",
      section: toggle.section || fxSlotSection(bank, slot),
      tags: { [toggle.tag]: cur ? "0" : "1" },
    });
    return;
  }
  if (toggle.kind === "tfx") {
    const bank = bankFromSection(toggle.section);
    const slot = slotFromSection(toggle.section);
    const cur = Number.parseInt(model.tfxSlots[bank]?.[slot]?.[toggle.tag] ?? "0", 10) || 0;
    onPatch({
      type: "tfx",
      section: toggle.section || fxSlotSection(bank, slot),
      tags: { [toggle.tag]: cur ? "0" : "1" },
    });
  }
}

export function MemoryChainBar({
  model,
  onPatch,
  memoryTab,
  onJumpTab,
}: {
  model: MemoryModel | null;
  onPatch: PatchHandler;
  memoryTab: string;
  onJumpTab: (tab: string) => void;
}) {
  const [visible, setVisible] = usePersistedTab("memory.chain", "off", CHAIN_VIS);
  const [zoom, setZoom] = usePersistedTab("memory.chainZoom", 1, ZOOM_PRESETS);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const graph = useMemo(() => (model ? buildMemoryFlowGraph(model) : null), [model]);

  const nodeByKey = useMemo(() => {
    const m = new Map<string, MemoryFlowNode>();
    if (!graph) return m;
    for (const n of graph.nodes) m.set(n.key, n);
    return m;
  }, [graph]);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !graph) return;
    const pad = 24;
    const sx = (el.clientWidth - pad * 2) / Math.max(1, graph.width);
    const sy = (el.clientHeight - pad * 2) / Math.max(1, graph.height);
    const best = snapZoom(Math.min(sx, sy, 1));
    setZoom(best);
    setPan({
      x: (el.clientWidth - graph.width * best) / 2,
      y: (el.clientHeight - graph.height * best) / 2,
    });
  }, [graph, setZoom]);

  const sizeKey = graph ? `${graph.width}x${graph.height}` : "";
  useEffect(() => {
    if (!graph || visible !== "on") return;
    const el = viewportRef.current;
    if (!el) return;
    setPan({
      x: Math.max(12, (el.clientWidth - graph.width * zoom) / 2),
      y: Math.max(12, (el.clientHeight - graph.height * zoom) / 2),
    });
  }, [sizeKey, visible]); // eslint-disable-line react-hooks/exhaustive-deps -- recenter on world size only

  function bumpZoom(delta: number) {
    setZoom(snapZoom(zoom + delta));
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    bumpZoom(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".boss-node")) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > PAN_THRESHOLD || Math.abs(dy) > PAN_THRESHOLD) d.moved = true;
    if (d.moved) setPan({ x: d.panX + dx, y: d.panY + dy });
  }

  function onPointerUp(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
  }

  function pickNode(node: MemoryFlowNode) {
    if (dragRef.current?.moved) return;
    setSelectedKey(node.key);
    const focus = chainFocusFor(node.selectId);
    for (const [key, value] of Object.entries(focus.prefs)) {
      saveUiTab(key, value);
    }
    onJumpTab(focus.tab);
  }

  function isSelected(node: MemoryFlowNode): boolean {
    if (selectedKey) return selectedKey === node.key;
    if (memoryTab === "loop" && node.kind === "track") {
      const track = readUiTab("loopTrack", 1, [1, 2, 3, 4, 5, 6] as const);
      return node.selectId === `track:${track}`;
    }
    if (memoryTab === "loop" && node.kind === "rhythm") {
      return readUiTab("loop", "track", ["track", "rec", "play", "rhythm"] as const) === "rhythm";
    }
    if (memoryTab === "mixer" && node.kind === "mix") return true;
    if (memoryTab === "output" && node.kind === "mfx") {
      return readUiTab("output.mem", "setup", ["setup", "routing", "eq", "mfx"] as const) === "mfx";
    }
    if (memoryTab === "output" && node.kind === "dest") {
      return readUiTab("output.mem", "setup", ["setup", "routing", "eq", "mfx"] as const) === "routing";
    }
    if (memoryTab === "input" && node.kind === "input") return true;
    return false;
  }

  return (
    <div className="memory-chain">
      <div className="memory-chain-toolbar">
        <button
          type="button"
          className={`tone-view-btn${visible === "on" ? " active" : ""}`}
          aria-pressed={visible === "on"}
          title={visible === "on" ? "Hide signal chain" : "Show signal chain"}
          onClick={() => setVisible(visible === "on" ? "off" : "on")}
        >
          <Icon name="chain" size={14} />
          Chain
        </button>
        {visible === "on" ? (
          <div className="memory-chain-zoom" role="group" aria-label="Chain zoom">
            <button
              type="button"
              className="btn ghost chain-zoom-btn"
              onClick={() => bumpZoom(-ZOOM_STEP)}
              title="Zoom out"
            >
              −
            </button>
            <span className="chain-zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn ghost chain-zoom-btn"
              onClick={() => bumpZoom(ZOOM_STEP)}
              title="Zoom in"
            >
              +
            </button>
            <button type="button" className="btn ghost chain-zoom-btn" onClick={fit} title="Fit to view">
              Fit
            </button>
          </div>
        ) : null}
      </div>

      {visible === "on" && graph && model ? (
        <div
          ref={viewportRef}
          className="chain-viewport boss-chain-canvas"
          role="list"
          aria-label="Memory signal chain"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest(".boss-node")) return;
            fit();
          }}
        >
          <div
            className="chain-world"
            style={{
              width: graph.width,
              height: graph.height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <div
              className="scene-mix-bus scene-mix-bus--horizontal"
              style={{
                left: graph.mixBus.left,
                top: graph.mixBus.top,
                width: graph.mixBus.width,
                height: graph.mixBus.height,
              }}
              aria-hidden
            />
            <svg className="boss-chain-wires" width={graph.width} height={graph.height} aria-hidden>
              {graph.edges.map((edge) => {
                const from = nodeByKey.get(edge.from);
                const to = nodeByKey.get(edge.to);
                if (!from || !to) return null;
                const lane = edge.lane ?? "serial";
                return (
                  <path
                    key={edge.id}
                    d={memoryEdgePath(from, to, edge.kind)}
                    className={[
                      "boss-wire",
                      `boss-wire--${laneWireClass(lane)}`,
                      edge.kind === "send" ? "boss-wire--send" : "",
                      edge.inactive ? "is-inactive" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    fill="none"
                  />
                );
              })}
            </svg>
            <div className="boss-chain-nodes" style={{ width: graph.width, height: graph.height }}>
              {graph.bands.map((band) => (
                <div
                  key={band.lane}
                  className={["boss-path-band", band.inactive ? "is-inactive" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: band.x, top: band.y, width: band.w, height: band.h }}
                >
                  <span>{band.label}</span>
                </div>
              ))}
              {graph.nodes.map((node) => (
                <FlowBlock
                  key={node.key}
                  node={node}
                  selected={isSelected(node)}
                  onSelect={() => pickNode(node)}
                  onToggle={node.toggle ? () => applyToggle(model, node.toggle!, onPatch) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
