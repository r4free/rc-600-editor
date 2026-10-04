import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./Modal";

const ROWS: { param: string; value: string; defaultValue?: string; text: string[] }[] = [
  { param: "SW", value: "OFF, ON", defaultValue: "OFF", text: ["Sets the FX sequence function on/off."] },
  {
    param: "SYNC",
    value: "OFF, ON",
    defaultValue: "OFF",
    text: [
      "Sets whether to synchronize loop playback with the FX sequence (ON) or not (OFF).",
      "When this is “ON”, the beginning of the FX sequence (step 1) is cued up.",
    ],
  },
  {
    param: "RETRIG",
    value: "OFF, ON",
    defaultValue: "OFF",
    text: [
      "If this is turned “ON”, the beginning of the phrase playing back in a loop is synchronized with the beginning of the FX sequence (step 1) when you use an onboard switch or external footswitch to which effect on/off is assigned, to turn the effect on that’s set in the FX sequence.",
    ],
  },
  {
    param: "TARGET",
    value: "",
    text: [
      "Sets the parameter that the FX sequence changes.",
      "The value (parameter) changes depending on the effect. Parameters that can be set as a TARGET are marked with a ★ in the Parameter Guide (blue stars indicate initial values).",
    ],
  },
  { param: "RATE", value: "0–100, 4MEAS, 2MEAS, 1MEAS, note values", text: ["Sets the step’s cycle."] },
  { param: "MAX", value: "1–16", defaultValue: "16", text: ["Sets the maximum number of steps."] },
  { param: "VAL1–16", value: "1–16", text: ["Sets how much the effect for each step changes."] },
];

function valueCell(value: string, defaultValue?: string) {
  if (!defaultValue) return value;
  const parts = value.split(defaultValue);
  if (parts.length < 2) return value;
  return (
    <>
      {parts[0]}
      <strong>{defaultValue}</strong>
      {parts.slice(1).join(defaultValue)}
    </>
  );
}

export function FxSequenceGuideModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <Modal title="About FX sequences" onClose={onClose} wide className="fx-seq-guide">
      <p>
        This function changes the effects according to the settings of each step (maximum of 16 steps). You can also
        change effects in sync with loop performance.
      </p>
      <ul>
        <li>
          Effects that can use the FX sequence function are indicated by the <span className="fx-seq-guide-badge">SEQ</span>{" "}
          mark.
        </li>
        <li>The FX sequence parameters are shown below. Set the parameters for each effect.</li>
      </ul>
      <div className="fx-seq-guide-table-wrap">
        <table className="fx-seq-guide-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>
                Value <small>(bold: default)</small>
              </th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.param}>
                <th scope="row">{row.param}</th>
                <td>{valueCell(row.value, row.defaultValue)}</td>
                <td>
                  {row.text.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fx-seq-guide-source">Source: Boss RC-600 Parameter Guide.</p>
    </Modal>,
    document.body,
  );
}
