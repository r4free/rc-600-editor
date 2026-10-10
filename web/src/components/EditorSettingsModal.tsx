import {
  AUTO_SAVE_MAX_SECONDS,
  AUTO_SAVE_MIN_SECONDS,
  START_MEMORIES,
  TUNER_VIEWS,
  type EditorSettings,
  type StartMemory,
  type TunerView,
} from "../editorSettings";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { Modal } from "./Modal";

type BoolSetting = { [K in keyof EditorSettings]: EditorSettings[K] extends boolean ? K : never }[keyof EditorSettings];

const TUNER_VIEW_LABELS: Record<TunerView, string> = {
  full: "Full Screen",
  window: "Small Window",
};

const START_MEMORY_LABELS: Record<StartMemory, string> = {
  last: "Last Selected",
  first: "First Memory",
};

function SettingLabel({ id, label, info }: { id: string; label: string; info: string }) {
  return (
    <div className="param-label">
      <label htmlFor={id}>{label}</label>
      <InfoTip label={label} text={info} />
    </div>
  );
}

function SwitchSetting({
  setting,
  label,
  info,
  settings,
  onChange,
}: {
  setting: BoolSetting;
  label: string;
  info: string;
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}) {
  const id = `editor-setting-${setting}`;
  const on = settings[setting];
  return (
    <div className="param-row">
      <SettingLabel id={id} label={label} info={info} />
      <div className="param-control">
        <button
          id={id}
          type="button"
          role="switch"
          className={`power-switch${on ? " on" : ""}`}
          aria-checked={on}
          onClick={() => onChange({ [setting]: !on })}
        >
          <span className="power-switch-track">
            <span className="power-switch-thumb" />
          </span>
          <span className="power-switch-state">{on ? "ON" : "OFF"}</span>
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: IconName; children: string }) {
  return (
    <h3 className="section-title editor-settings-section">
      <Icon name={icon} size={14} />
      {children}
      {children === "Layout" ? (
        <InfoTip label="Editor settings" text="These settings change how the editor looks and behaves. They are saved in this browser only." />
      ) : null}
    </h3>
  );
}

export function EditorSettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
  onClose: () => void;
}) {
  const common = { settings, onChange };
  return (
    <Modal title="Editor settings" onClose={onClose} wide className="editor-settings-modal">
      <SectionTitle icon="board">Layout</SectionTitle>
      <div className="param-columns">
        <SwitchSetting
          {...common}
          setting="fullWidth"
          label="Full Width"
          info="Removes the side margins and the maximum width around the editor so it stretches across the whole window."
        />
        <SwitchSetting
          {...common}
          setting="showBreadcrumbs"
          label="Show Breadcrumbs"
          info="Shows the navigation path above the editor content (for example Memory › Loop › Track 1). Turn it off for a cleaner view."
        />
        <SwitchSetting
          {...common}
          setting="showGuide"
          label="Show Guide"
          info="Shows the Guide button in the top bar, which opens the user guide in a new tab."
        />
      </div>

      <SectionTitle icon="library">Memory Editor</SectionTitle>
      <div className="param-columns">
        <SwitchSetting
          {...common}
          setting="showMemorySidebar"
          label="Show Memory Sidebar"
          info="Shows the list of memories on the left of the memory editor. When off, the Memory tab becomes a memory picker: choosing a memory loads it and opens the memory editor, which then uses the full width."
        />
        <SwitchSetting
          {...common}
          setting="showChain"
          label="Show Chain"
          info="Adds the Chain button above the memory editor tabs. It opens a signal-chain diagram of the memory (inputs, effects, tracks, outputs); clicking a block jumps to its settings. Off by default."
        />
        <SwitchSetting
          {...common}
          setting="show3dModel"
          label="Show 3D Model"
          info="Adds the 3D Model button above the memory editor tabs. It opens a rotatable model of the RC-600. Off by default."
        />
        <div className="param-row">
          <SettingLabel
            id="editor-setting-startMemory"
            label="Start Memory"
            info="Which memory is selected when you open the RC-600 folder, an offline session or a backup: the last memory you selected (remembered in this browser) or always the first memory."
          />
          <div className="param-control">
            <select
              id="editor-setting-startMemory"
              value={settings.startMemory}
              onChange={(e) => onChange({ startMemory: e.target.value as StartMemory })}
            >
              {START_MEMORIES.map((mode) => (
                <option key={mode} value={mode}>
                  {START_MEMORY_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <SectionTitle icon="save">Saving</SectionTitle>
      <div className="param-columns">
        <SwitchSetting
          {...common}
          setting="autoSave"
          label="Auto Save"
          info="Memory and System changes are saved automatically at the Auto Save Interval, and the Save / Discard buttons (including Save system) are hidden. With the RC-600 folder open they are written to the pedal (after the backup is confirmed); in an offline session they are kept with your offline edits for Export edits / Export ZIP. Off by default."
        />
        <div className={`param-row${settings.autoSave ? "" : " readonly"}`}>
          <SettingLabel
            id="editor-setting-autoSaveSeconds"
            label="Auto Save Interval"
            info={`How often pending memory and System changes are saved, from ${AUTO_SAVE_MIN_SECONDS} to ${AUTO_SAVE_MAX_SECONDS} seconds. Default 10 seconds. Used while Auto Save is on.`}
          />
          <div className="param-control param-slider">
            <input
              id="editor-setting-autoSaveSeconds"
              type="range"
              min={AUTO_SAVE_MIN_SECONDS}
              max={AUTO_SAVE_MAX_SECONDS}
              value={settings.autoSaveSeconds}
              disabled={!settings.autoSave}
              onChange={(e) => onChange({ autoSaveSeconds: Number(e.target.value) })}
            />
            <span className="param-val">{settings.autoSaveSeconds} s</span>
          </div>
        </div>
      </div>

      <SectionTitle icon="guitar">Tuner</SectionTitle>
      <div className="param-columns">
        <div className="param-row">
          <SettingLabel
            id="editor-setting-tunerView"
            label="Tuner View"
            info="How the Tuner tab opens: Full Screen covers the whole window, Small Window opens a compact tuner over the editor. You can also switch between the two from inside the tuner."
          />
          <div className="param-control">
            <select
              id="editor-setting-tunerView"
              value={settings.tunerView}
              onChange={(e) => onChange({ tunerView: e.target.value as TunerView })}
            >
              {TUNER_VIEWS.map((view) => (
                <option key={view} value={view}>
                  {TUNER_VIEW_LABELS[view]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
