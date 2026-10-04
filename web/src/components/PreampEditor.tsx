import { useRef, type CSSProperties, type ReactNode } from "react";
import type { ParamDef } from "@rc600/catalog/params";
import type { TagMap } from "@rc600/rc0/memory";
import { EqFader } from "./EqFaders";
import { InfoTip } from "./InfoTip";

type PreampEditorProps = {
  idPrefix: string;
  params: ParamDef[];
  tags: TagMap;
  onChange: (tag: string, value: number) => void;
};

const PREAMP_FADER_TAGS = ["C", "D", "E", "F", "G", "H", "L"];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const value = parseInt(tags[tag] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function optionLabel(def: ParamDef, value: number): string {
  return def.options?.find((option) => option.value === value)?.label ?? String(value);
}

function AmpPicture({ index }: { index: number }) {
  const stacks = index >= 4 && index !== 6 ? 2 : 1;
  const speakers = index === 2 ? 1 : index >= 4 ? 4 : 2;
  return (
    <span className={`preamp-amp-picture amp-${index}`} aria-hidden="true">
      {Array.from({ length: stacks }, (_, cabinet) => (
        <span className="preamp-amp-cab" key={cabinet}>
          {cabinet === 0 ? <span className="preamp-amp-panel" /> : null}
          <span className="preamp-amp-cloth">
            {Array.from({ length: speakers }, (_, speaker) => (
              <span className="preamp-amp-cone" key={speaker} />
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

function SpeakerPicture({ index }: { index: number }) {
  if (index === 0) return <span className="preamp-speaker-off" aria-hidden="true">×</span>;
  const layouts: Record<number, number> = { 1: 2, 2: 1, 3: 1, 4: 1, 5: 2, 6: 4, 7: 4, 8: 8 };
  const count = layouts[index] ?? 1;
  return (
    <span className={`preamp-speaker-picture speaker-${index}`} aria-hidden="true">
      <span className="preamp-speaker-grille">
        {Array.from({ length: count }, (_, speaker) => (
          <span className="preamp-speaker-cone" key={speaker} />
        ))}
      </span>
    </span>
  );
}

function PictureSlider({
  def,
  value,
  picture,
  onChange,
}: {
  def: ParamDef;
  value: number;
  picture: (index: number) => ReactNode;
  onChange: (value: number) => void;
}) {
  const options = def.options ?? [];
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const current = options[currentIndex];
  const swipeStart = useRef<{ pointerId: number; x: number } | null>(null);
  const selectIndex = (index: number) => {
    const option = options[(index + options.length) % options.length];
    if (option) onChange(option.value);
  };
  if (!current) return null;

  return (
    <div className="preamp-image-slider" role="group" aria-label={def.name}>
      <button
        type="button"
        className="preamp-slider-arrow"
        aria-label={`Previous ${def.name}`}
        onClick={() => selectIndex(currentIndex - 1)}
      >
        ‹
      </button>
      <div
        className="preamp-slider-stage"
        aria-live="polite"
        title="Swipe left or right to change."
        onPointerDown={(event) => {
          swipeStart.current = { pointerId: event.pointerId, x: event.clientX };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          if (!start || start.pointerId !== event.pointerId) return;
          const delta = event.clientX - start.x;
          if (Math.abs(delta) >= 28) selectIndex(currentIndex + (delta < 0 ? 1 : -1));
        }}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {picture(currentIndex)}
        <strong>{current.label}</strong>
      </div>
      <button
        type="button"
        className="preamp-slider-arrow"
        aria-label={`Next ${def.name}`}
        onClick={() => selectIndex(currentIndex + 1)}
      >
        ›
      </button>
    </div>
  );
}

function MicPicture({ index }: { index: number }) {
  return (
    <span className={`preamp-mic-icon mic-${index}`} aria-hidden="true">
      <span className="preamp-mic-head" />
      <span className="preamp-mic-body" />
    </span>
  );
}

function MicScene({
  speaker,
  mic,
  distance,
  position,
  onPositionChange,
}: {
  speaker: number;
  mic: number;
  distance: number;
  position: number;
  onPositionChange: (position: number) => void;
}) {
  const illustratedPosition = 48 + position * 3.2;
  const sceneStyle = {
    "--mic-x": `${illustratedPosition}%`,
    "--target-x": `${illustratedPosition}%`,
    "--mic-scale": distance === 0 ? "0.72" : "1.02",
  } as CSSProperties;
  const choosePosition = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const distanceFromCenter = Math.abs(clientX - (rect.left + rect.width / 2));
    onPositionChange(Math.round(Math.min(1, distanceFromCenter / (rect.width / 2)) * 10));
  };
  return (
    <div
      className={`preamp-mic-scene${speaker === 0 ? " is-speaker-off" : ""}${distance === 0 ? " is-off-mic" : " is-on-mic"}`}
      style={sceneStyle}
    >
      <div className="preamp-scene-cab">
        <div
          className="preamp-speaker-hotspot"
          role="slider"
          tabIndex={0}
          aria-label="Mic position on speaker"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={position}
          aria-valuetext={position === 0 ? "Center" : `${position} cm from center`}
          title="Click the speaker to place the microphone."
          onPointerDown={(event) => choosePosition(event.clientX, event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              onPositionChange(Math.max(0, position - 1));
            } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              onPositionChange(Math.min(10, position + 1));
            } else if (event.key === "Home") {
              event.preventDefault();
              onPositionChange(0);
            } else if (event.key === "End") {
              event.preventDefault();
              onPositionChange(10);
            }
          }}
        >
          <SpeakerPicture index={speaker} />
          <span className="preamp-scene-center" />
          <span className="preamp-scene-target" />
        </div>
      </div>
      <div className="preamp-scene-mic" aria-hidden="true">
        <MicPicture index={mic} />
        <span className="preamp-mic-stand" />
      </div>
      <span className="preamp-scene-caption">
        Click the speaker to position the mic · {position === 0 ? "Center" : `${position} cm from center`}
      </span>
    </div>
  );
}

export function PreampEditor({ idPrefix, params, tags, onChange }: PreampEditorProps) {
  const byTag = (tag: string) => params.find((param) => param.tag === tag);
  const ampDef = byTag("A");
  const speakerDef = byTag("B");
  const gainDef = byTag("C");
  const compDef = byTag("D");
  const micDef = byTag("I");
  const distanceDef = byTag("J");
  const positionDef = byTag("K");
  const levelDef = byTag("L");
  if (!ampDef || !speakerDef || !gainDef || !compDef || !micDef || !distanceDef || !positionDef || !levelDef) {
    return null;
  }

  const value = (def: ParamDef) => num(tags, def.tag, def.default ?? 0);
  const amp = value(ampDef);
  const speaker = value(speakerDef);
  const mic = value(micDef);
  const distance = value(distanceDef);
  const position = value(positionDef);

  return (
    <section className="preamp-editor">
      <div className="preamp-selector-row">
        <div className="preamp-section preamp-large-selector">
          <div className="ifx-group-head">
            <h4>Amp Type</h4>
            <InfoTip label={ampDef.name} text={ampDef.info ?? "Selects the preamp type."} />
          </div>
          <PictureSlider
            def={ampDef}
            value={amp}
            picture={(index) => <AmpPicture index={index} />}
            onChange={(next) => onChange(ampDef.tag, next)}
          />
        </div>

        <div className="preamp-section preamp-large-selector">
          <div className="ifx-group-head">
            <h4>Speaker Type</h4>
            <InfoTip label={speakerDef.name} text={speakerDef.info ?? "Selects the speaker type."} />
          </div>
          <PictureSlider
            def={speakerDef}
            value={speaker}
            picture={(index) => <SpeakerPicture index={index} />}
            onChange={(next) => onChange(speakerDef.tag, next)}
          />
        </div>

        <div className="preamp-section preamp-rig-selector">
          <div className="ifx-group-head">
            <h4>Speaker &amp; Microphone</h4>
            <InfoTip
              label="Speaker and microphone"
              text="Click a microphone to apply it. On Mic and Off Mic are shown as an illustrative near/far view while the correct setting is sent to the pedal. Click the speaker image to move the microphone from the cone center toward its edge."
            />
          </div>
          <div className="preamp-rig-layout">
            <MicScene
              speaker={speaker}
              mic={mic}
              distance={distance}
              position={position}
              onPositionChange={(next) => onChange(positionDef.tag, next)}
            />
            <div className="preamp-mic-list" role="radiogroup" aria-label={micDef.name}>
              {micDef.options?.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mic === option.value}
                  className={mic === option.value ? "is-selected" : ""}
                  title={`Use ${option.label}`}
                  onClick={() => onChange(micDef.tag, option.value)}
                >
                  <MicPicture index={index} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="preamp-distance-inline">
            <span>{distanceDef.name}</span>
            <div className="view-toggle" role="radiogroup" aria-label={distanceDef.name}>
              {distanceDef.options?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={distance === option.value}
                  className={`view-toggle-btn${distance === option.value ? " active" : ""}`}
                  onClick={() => onChange(distanceDef.tag, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="preamp-section preamp-eq-section">
        <div className="ifx-group-head">
          <h4>Amp Controls &amp; Equalizer</h4>
          <InfoTip
            label="Amp controls and equalizer"
            text="Gain sets distortion, T-Comp changes the compression feel, the four tone controls shape the sound, and Effect Level sets the output. Double-click a fader to restore its default."
          />
        </div>
        <div className="eq-board preamp-eq-board">
          <div className="eq-board-bands">
            {PREAMP_FADER_TAGS.map((tag) => {
              const def = byTag(tag);
              return def ? (
                <section key={tag} className="eq-band">
                  <div className="eq-band-faders">
                    <EqFader
                      id={`${idPrefix}-${tag}`}
                      def={def}
                      short={tag === "L" ? "Output" : tag === "D" ? "Feel" : "Tone"}
                      value={value(def)}
                      display={(_, next) => ({
                        value: tag === "D" ? String(next - 10) : String(next),
                      })}
                      onChange={(next) => onChange(tag, next)}
                    />
                  </div>
                  <h4 className="eq-band-title">{def.name}</h4>
                </section>
              ) : null;
            })}
          </div>
        </div>
      </div>
      <span className="sr-only">
        Current amp: {optionLabel(ampDef, amp)}. Current speaker: {optionLabel(speakerDef, speaker)}.
      </span>
    </section>
  );
}
