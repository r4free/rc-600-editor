import { useCallback, useEffect, useRef, useState } from "react";
import { isLikelyRc600 } from "@rc600/midi/rc600-midi";
import {
  detectPitch,
  frequencyToNote,
  signalRms,
  type DetectedNote,
} from "../tuner/pitch";
import { Icon } from "./Icon";

const TUNER_PREFS_KEY = "rc600.tuner.prefs";
const ANALYSIS_INTERVAL_MS = 50;
const NOTE_HOLD_MS = 250;

interface TunerPrefs {
  a4: number;
  deviceId: string;
}

function loadPrefs(): TunerPrefs {
  const fallback = { a4: 440, deviceId: "" };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(TUNER_PREFS_KEY) ?? "{}") as Partial<TunerPrefs>;
    return {
      a4:
        typeof parsed.a4 === "number" && parsed.a4 >= 430 && parsed.a4 <= 450
          ? Math.round(parsed.a4)
          : fallback.a4,
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : "",
    };
  } catch {
    return fallback;
  }
}

function savePrefs(prefs: TunerPrefs): void {
  try {
    localStorage.setItem(TUNER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota */
  }
}

function preferredInput(devices: readonly MediaDeviceInfo[]): MediaDeviceInfo | undefined {
  return (
    devices.find((device) => isLikelyRc600(device.label)) ??
    devices.find((device) => /boss|roland/i.test(device.label)) ??
    devices[0]
  );
}

function inputConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: false,
    autoGainControl: false,
    noiseSuppression: false,
  };
}

function audioErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Audio input permission was denied. Allow microphone access in the browser and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "The selected audio input is unavailable. Connect the RC-600 and choose its USB audio input.";
    }
    if (error.name === "NotReadableError") {
      return "The audio input is busy in another app. Close the other app and try again.";
    }
  }
  return error instanceof Error ? error.message : "Could not open the audio input.";
}

export function TunerTab({
  usbStorageActive = false,
  onEjectUsb,
  onExit,
}: {
  usbStorageActive?: boolean;
  onEjectUsb?: () => void;
  onExit: () => void;
}) {
  const initialPrefs = useRef(loadPrefs()).current;
  const [a4, setA4] = useState(initialPrefs.a4);
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialPrefs.deviceId);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [note, setNote] = useState<DetectedNote | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTokenRef = useRef(0);
  const a4Ref = useRef(a4);

  useEffect(() => {
    a4Ref.current = a4;
    savePrefs({ a4, deviceId: selectedDeviceId });
  }, [a4, selectedDeviceId]);

  const stopListening = useCallback(() => {
    startTokenRef.current += 1;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") void context.close();
    setListening(false);
    setStarting(false);
    setNote(null);
    setLevel(0);
  }, []);

  const startListening = useCallback(
    async (requestedDeviceId = selectedDeviceId) => {
      stopListening();
      if (usbStorageActive) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Audio input is not supported in this browser. Use Chrome or Edge over HTTPS.");
        return;
      }

      const token = startTokenRef.current;
      setStarting(true);
      setError(null);

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: inputConstraints(requestedDeviceId || undefined),
        });
        if (token !== startTokenRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === "audioinput",
        );
        setDevices(inputs);

        const currentId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? "";
        const preferred = requestedDeviceId
          ? inputs.find((device) => device.deviceId === requestedDeviceId)
          : preferredInput(inputs);

        if (preferred && preferred.deviceId !== currentId) {
          stream.getTracks().forEach((track) => track.stop());
          stream = await navigator.mediaDevices.getUserMedia({
            audio: inputConstraints(preferred.deviceId),
          });
        }
        if (token !== startTokenRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const activeDeviceId =
          stream.getAudioTracks()[0]?.getSettings().deviceId ?? preferred?.deviceId ?? "";
        setSelectedDeviceId(activeDeviceId);

        const context = new AudioContext();
        await context.resume();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 8_192;
        analyser.smoothingTimeConstant = 0;
        source.connect(analyser);

        streamRef.current = stream;
        contextRef.current = context;
        setListening(true);
        setStarting(false);

        const samples = new Float32Array(analyser.fftSize);
        let lastAnalysisAt = 0;
        let lastPitchAt = 0;

        const analyse = (now: number) => {
          if (token !== startTokenRef.current) return;
          animationRef.current = requestAnimationFrame(analyse);
          if (now - lastAnalysisAt < ANALYSIS_INTERVAL_MS) return;
          lastAnalysisAt = now;

          analyser.getFloatTimeDomainData(samples);
          const rms = signalRms(samples);
          setLevel(Math.min(1, rms * 5));
          const frequency = detectPitch(samples, context.sampleRate);
          if (frequency !== null) {
            lastPitchAt = now;
            setNote(frequencyToNote(frequency, a4Ref.current));
          } else if (now - lastPitchAt > NOTE_HOLD_MS) {
            setNote(null);
          }
        };
        animationRef.current = requestAnimationFrame(analyse);
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        if (token === startTokenRef.current) {
          setStarting(false);
          setListening(false);
          setError(audioErrorMessage(cause));
        }
      }
    },
    [selectedDeviceId, stopListening, usbStorageActive],
  );

  useEffect(() => stopListening, [stopListening]);

  useEffect(() => {
    if (usbStorageActive) stopListening();
  }, [stopListening, usbStorageActive]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      setDevices(allDevices.filter((device) => device.kind === "audioinput"));
    });
  }, []);

  const changeDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    savePrefs({ a4, deviceId });
    if (listening) void startListening(deviceId);
  };

  const cents = note ? Math.max(-50, Math.min(50, note.cents)) : 0;
  const inTune = note !== null && Math.abs(note.cents) <= 5;
  const audioSupported = Boolean(navigator.mediaDevices?.getUserMedia);

  return (
    <div className={`tuner-body${usbStorageActive ? " is-storage-blocked" : ""}`}>
      {usbStorageActive ? (
        <div className="tuner-storage-warning" role="status">
          <div>
            <strong>USB Storage is active.</strong>
            <span>
              Eject USB, wait until the pedal leaves DISCONNECTING, then set MENU → USB → STORAGE
              Off. The tuner needs the RC-600 USB audio input.
            </span>
          </div>
          {onEjectUsb ? (
            <button type="button" className="btn warn" onClick={onEjectUsb}>
              <Icon name="eject" size={15} />
              Eject USB
            </button>
          ) : null}
        </div>
      ) : null}

      <header className="tuner-header">
        <div>
          <h2>USB Audio Tuner</h2>
          <p>Chromatic tuner using the audio sent from the RC-600 to this computer.</p>
        </div>
        <div className="tuner-header-actions">
          <button
            type="button"
            className={`btn ${listening ? "warn" : "primary"}`}
            disabled={usbStorageActive || starting || !audioSupported}
            onClick={() => (listening ? stopListening() : void startListening())}
          >
            <Icon name={listening ? "stop" : "mic"} size={16} />
            {starting ? "Starting…" : listening ? "Stop" : "Listen"}
          </button>
          <button type="button" className="btn ghost" onClick={onExit}>
            <Icon name="fullscreenExit" size={16} />
            Exit tuner
          </button>
        </div>
      </header>

      <div className="tuner-settings">
        <div className="param-row">
          <div className="param-label">
            <label htmlFor="tuner-input">Input device</label>
          </div>
          <div className="param-control">
            <select
              id="tuner-input"
              value={selectedDeviceId}
              disabled={usbStorageActive || starting}
              onChange={(event) => changeDevice(event.target.value)}
            >
              <option value="">Default audio input</option>
              {devices.map((device, index) => (
                <option key={device.deviceId || `input-${index}`} value={device.deviceId}>
                  {device.label || `Audio input ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="param-row">
          <div className="param-label">
            <label htmlFor="tuner-a4">A4 reference</label>
          </div>
          <div className="param-control param-slider">
            <input
              id="tuner-a4"
              type="range"
              min={430}
              max={450}
              value={a4}
              onChange={(event) => setA4(Number(event.target.value))}
            />
            <span className="param-val">{a4} Hz</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="tuner-error" role="alert">
          <Icon name="alert" />
          {error}
        </div>
      ) : null}

      <section className={`tuner-display${inTune ? " is-in-tune" : ""}`} aria-live="polite">
        <div className="tuner-note" aria-label={note ? `${note.name}${note.octave}` : "No note"}>
          {note ? (
            <>
              <span>{note.name}</span>
              <small>{note.octave}</small>
            </>
          ) : (
            <span>—</span>
          )}
        </div>

        <div className="tuner-meter" aria-label={note ? `${note.cents} cents` : "Waiting for signal"}>
          <div className="tuner-meter-scale" aria-hidden="true">
            <span>−50</span>
            <span>−25</span>
            <span>0</span>
            <span>+25</span>
            <span>+50</span>
          </div>
          <div className="tuner-meter-track">
            <span className="tuner-in-tune-band" />
            <span
              className={`tuner-needle${note ? " is-active" : ""}`}
              style={{ left: `${cents + 50}%` }}
            />
          </div>
        </div>

        <div className="tuner-readouts">
          <span>{note ? `${note.hz.toFixed(1)} Hz` : "— Hz"}</span>
          <strong>
            {note ? `${note.cents > 0 ? "+" : ""}${note.cents} cents` : "Play a note"}
          </strong>
        </div>
      </section>

      <div className="tuner-input-level">
        <span>Input level</span>
        <div
          className="tuner-level-track"
          role="meter"
          aria-label="Input level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
        >
          <span style={{ width: `${level * 100}%` }} />
        </div>
      </div>

      <p className="tuner-hint">
        Choose the RC-600 audio input. If the meter stays empty, check the pedal’s USB routing and
        make sure System → USB → Output Level is above 0.
      </p>
    </div>
  );
}
