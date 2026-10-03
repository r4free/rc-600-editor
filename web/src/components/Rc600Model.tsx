import { useRef, useState } from "react";
import "./Rc600Model.css";

/** Photo-textured CSS geometry reused from the original RC-600 model demonstration. */
export function Rc600Model() {
  const [view, setView] = useState({ pitch: 56, yaw: -16, zoom: 1 });
  const drag = useRef<{ x: number; y: number; pitch: number; yaw: number } | null>(null);
  const assetBase = `${import.meta.env.BASE_URL}rc600-model`;
  const zoom = (delta: number) => setView(v => ({ ...v, zoom: Math.min(1.65, Math.max(.45, v.zoom + delta)) }));
  return (
    <section className="rc3" aria-label="Boss RC-600 3D model">
      <div className="rc3-camera" role="group" aria-label="Model camera">
        <button type="button" onClick={() => setView({ pitch: 56, yaw: -16, zoom: 1 })}>Perspective</button>
        <button type="button" onClick={() => setView({ pitch: 0, yaw: 0, zoom: 1 })}>Panel</button>
        <button type="button" onClick={() => setView({ pitch: -90, yaw: 0, zoom: 1 })}>Rear</button>
        <button type="button" onClick={() => zoom(-.15)} aria-label="Zoom out model">−</button>
        <button type="button" onClick={() => zoom(.15)} aria-label="Zoom in model">+</button>
      </div>
      <p className="hint">Drag to rotate. Use + and − to zoom.</p>
      <div className="rc3-stage" tabIndex={0} aria-label="Rotate model with arrow keys; zoom with plus and minus"
        onKeyDown={e => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"].includes(e.key)) {
            e.preventDefault();
            if (e.key === "+" || e.key === "=") zoom(.15);
            else if (e.key === "-") zoom(-.15);
            else setView(v => ({ ...v, yaw: v.yaw + (e.key === "ArrowLeft" ? -10 : e.key === "ArrowRight" ? 10 : 0), pitch: Math.max(-155, Math.min(155, v.pitch + (e.key === "ArrowUp" ? 10 : e.key === "ArrowDown" ? -10 : 0))) }));
          }
        }}
        onPointerDown={e => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, pitch: view.pitch, yaw: view.yaw };
        }}
        onPointerMove={e => {
          const d = drag.current;
          if (d) setView(v => ({ ...v, pitch: Math.min(155, Math.max(-155, d.pitch - (e.clientY - d.y) * .35)), yaw: d.yaw + (e.clientX - d.x) * .4 }));
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <div className="rc3-fit"><div className="rc3-body" style={{ transform: `scale(${view.zoom}) rotateX(${view.pitch}deg) rotateZ(${view.yaw}deg)` }}>
          <div className="rc3-face rc3-panel" style={{ backgroundImage: `url("${assetBase}/front.webp")` }} />
          <div className="rc3-face rc3-rear" style={{ backgroundImage: `url("${assetBase}/back.webp")` }} />
          <div className="rc3-face rc3-front" />
          <div className="rc3-face rc3-side rc3-left" /><div className="rc3-face rc3-side rc3-right" />
          <div className="rc3-face rc3-bottom" />
        </div></div>
      </div>
    </section>
  );
}
