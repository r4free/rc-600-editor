import { useEffect, useRef, useState } from "react";
import { useAudioInputSession } from "../audio/useAudioInputSession";
import type { SongKeyMode } from "../presets/playlist";
import {
  detectPitch,
  frequencyToNote,
  signalRms,
  type DetectedNote,
} from "../tuner/pitch";
import {
  classifyVoiceAgainstChord,
  classifyVoicePitch,
  initialVoiceStability,
  rollingCompatibility,
  updateVoiceStability,
  type VoiceRelationship,
  type ChordRelationship,
} from "../voice-tone/analysis";
import { Icon } from "./Icon";

const VOICE_TONE_PREFS_KEY = "rc600.voiceTone.prefs";

type StereoSide = "left" | "right";

interface VoiceTonePrefs {
  voiceSide: StereoSide;
}

function loadPrefs(): VoiceTonePrefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(VOICE_TONE_PREFS_KEY) ?? "{}") as Partial<VoiceTonePrefs>;
    return { voiceSide: parsed.voiceSide === "left" ? "left" : "right" };
  } catch {
    return { voiceSide: "right" };
  }
}

function saveVoiceSide(voiceSide: StereoSide): void {
  try {
    const current = JSON.parse(localStorage.getItem(VOICE_TONE_PREFS_KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(VOICE_TONE_PREFS_KEY, JSON.stringify({ ...current, voiceSide }));
  } catch {
    /* private mode / quota */
  }
}

export function VoiceToneMonitor({
  targetKey,
  mode,
  blocked,
  currentChord = null,
  targetNote = null,
}: {
  targetKey: string;
  mode: SongKeyMode;
  blocked: boolean;
  currentChord?: string | null;
  targetNote?: { midi: number; name: string } | null;
}) {
  const [voiceSide, setVoiceSide] = useState<StereoSide>(() => loadPrefs().voiceSide);
  const [leftLevel, setLeftLevel] = useState(0);
  const [rightLevel, setRightLevel] = useState(0);
  const [voiceNote, setVoiceNote] = useState<DetectedNote | null>(null);
  const [relationship, setRelationship] = useState<VoiceRelationship | null>(null);
  const [chordRelationship, setChordRelationship] = useState<ChordRelationship | null>(null);
  const [compatibility, setCompatibility] = useState<number | null>(null);
  const session = useAudioInputSession({
    preferenceKey: VOICE_TONE_PREFS_KEY,
    blocked,
    stereo: true,
  });
  const currentChordRef = useRef(currentChord);
  const targetRef = useRef({ key: targetKey, mode });

  useEffect(() => {
    currentChordRef.current = currentChord;
    if (!currentChord) setChordRelationship(null);
  }, [currentChord]);

  useEffect(() => {
    targetRef.current = { key: targetKey, mode };
  }, [mode, targetKey]);

  useEffect(() => {
    if (!session.stream) {
      setLeftLevel(0);
      setRightLevel(0);
      setVoiceNote(null);
      setRelationship(null);
      setChordRelationship(null);
      setCompatibility(null);
      return;
    }
    let cancelled = false;
    let animation: number | null = null;
    let context: AudioContext | null = null;
    const stream = session.stream;

    void (async () => {
      context = new AudioContext({ latencyHint: "interactive" });
      await context.resume();
      if (cancelled) {
        void context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const splitter = context.createChannelSplitter(2);
      const left = context.createAnalyser();
      const right = context.createAnalyser();
      left.fftSize = 8_192;
      right.fftSize = 8_192;
      source.connect(splitter);
      splitter.connect(left, 0);
      splitter.connect(right, 1);
      const leftSamples = new Float32Array(left.fftSize);
      const rightSamples = new Float32Array(right.fftSize);
      let lastUpdate = 0;
      let stability = initialVoiceStability();
      let events: { at: number; inKey: boolean }[] = [];
      let lastEventAt = 0;

      const analyse = (now: number) => {
        if (cancelled) return;
        animation = requestAnimationFrame(analyse);
        if (now - lastUpdate < 80) return;
        lastUpdate = now;
        left.getFloatTimeDomainData(leftSamples);
        right.getFloatTimeDomainData(rightSamples);
        setLeftLevel(Math.min(1, signalRms(leftSamples) * 5));
        setRightLevel(Math.min(1, signalRms(rightSamples) * 5));
        if (session.channelCount < 2) return;

        const voiceSamples = voiceSide === "left" ? leftSamples : rightSamples;
        const frequency = detectPitch(voiceSamples, context!.sampleRate, {
          minFrequency: 75,
          maxFrequency: 1_100,
          minRms: 0.008,
        });
        const detected = frequency === null ? null : frequencyToNote(frequency);
        stability = updateVoiceStability(stability, detected?.midi ?? null, now);
        if (
          detected &&
          stability.stableMidi === detected.midi
        ) {
          const target = targetRef.current;
          const nextRelationship = classifyVoicePitch(detected.midi, target.key, target.mode);
          setVoiceNote(detected);
          setRelationship(nextRelationship);
          const activeChord = currentChordRef.current;
          const nextChordRelationship = activeChord
            ? classifyVoiceAgainstChord(detected.midi, activeChord, target.key, target.mode)
            : null;
          setChordRelationship(nextChordRelationship);
          if (now - lastEventAt >= 200) {
            lastEventAt = now;
            events.push({
              at: now,
              inKey: nextChordRelationship
                ? nextChordRelationship.inChord
                : nextRelationship.inKey,
            });
            const rolling = rollingCompatibility(events, now);
            events = rolling.events;
            setCompatibility(rolling.percent);
          }
        } else if (stability.stableMidi === null) {
          setVoiceNote(null);
          setRelationship(null);
          setChordRelationship(null);
        }
      };
      animation = requestAnimationFrame(analyse);
    })().catch(() => session.stop());

    return () => {
      cancelled = true;
      if (animation !== null) cancelAnimationFrame(animation);
      if (context && context.state !== "closed") void context.close();
    };
  }, [session.channelCount, session.stream, session.stop, voiceSide]);

  const swap = () => {
    const next = voiceSide === "right" ? "left" : "right";
    setVoiceSide(next);
    saveVoiceSide(next);
  };
  const harmonySide = voiceSide === "right" ? "left" : "right";
  const separated = session.channelCount >= 2;
  const voiceLevel = voiceSide === "left" ? leftLevel : rightLevel;

  return (
    <section className="voice-tone-monitor">
      <div className="voice-tone-head">
        <div>
          <span className="playlist-eyebrow">Voice Tone Match</span>
          <strong>{targetKey} {mode}</strong>
        </div>
        <button
          type="button"
          className={`btn ${session.active ? "warn" : "primary"}`}
          disabled={blocked || session.starting || !session.supported}
          onClick={() => session.active ? session.stop() : void session.start()}
        >
          <Icon name={session.active ? "stop" : "mic"} />
          {session.starting ? "Starting…" : session.active ? "Stop monitoring" : "Start monitoring"}
        </button>
      </div>

      <div className="voice-tone-routing">
        <label className="playlist-field">
          <span>RC-600 audio input</span>
          <select
            value={session.selectedDeviceId}
            disabled={session.starting}
            onChange={(event) => session.selectDevice(event.target.value)}
          >
            <option value="">Default audio input</option>
            {session.devices.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label || `Audio input ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <div className="voice-tone-channel-map">
          <span>Harmony Reference: <b>{harmonySide}</b></span>
          <span>Voice Input: <b>{voiceSide}</b></span>
          <button type="button" className="btn ghost" onClick={swap}>Swap channels</button>
        </div>
      </div>

      <ChannelMeter
        label={`Left · ${voiceSide === "left" ? "Voice Input" : "Harmony Reference"}`}
        level={leftLevel}
      />
      <ChannelMeter
        label={`Right · ${voiceSide === "right" ? "Voice Input" : "Harmony Reference"}`}
        level={rightLevel}
      />

      {session.active && separated ? (
        <>
          <IntonationGauge note={voiceNote} targetNote={targetNote} />
          <div className="voice-tone-result" aria-live="polite">
            <div className="voice-tone-current-note">
              <strong>{voiceNote ? `${voiceNote.name}${voiceNote.octave}` : "—"}</strong>
              <span>
                {voiceNote
                  ? `${voiceNote.cents > 0 ? "+" : ""}${voiceNote.cents} cents`
                  : "Sing a sustained note"}
              </span>
            </div>
            <div>
              <span>Intonation</span>
              <strong>
                {!voiceNote
                  ? "Waiting"
                  : Math.abs(voiceNote.cents) <= 5
                    ? "In tune"
                    : voiceNote.cents > 0
                      ? "Sharp"
                      : "Flat"}
              </strong>
            </div>
            <div>
              <span>Scale relationship</span>
              <strong>
                {relationship
                  ? relationship.inKey
                    ? `${relationship.degree} · In key`
                    : "Outside key"
                  : "Waiting"}
              </strong>
            </div>
            <div>
              <span>Current chord</span>
              <strong>
                {currentChord
                  ? chordRelationship
                    ? `${currentChord} · ${chordRelationship.label}`
                    : `${currentChord} · Waiting`
                  : "Free key mode"}
              </strong>
            </div>
            <div>
              <span>Signal quality</span>
              <strong>{voiceLevel < 0.02 ? "Low" : voiceLevel > 0.85 ? "High" : "Good"}</strong>
            </div>
            <div>
              <span>Rolling compatibility</span>
              <strong>{compatibility === null ? "Collecting…" : `${compatibility}%`}</strong>
            </div>
          </div>
        </>
      ) : null}

      {session.active && !separated ? (
        <p className="voice-tone-warning" role="alert">
          Stereo separation was not confirmed by the browser. Select an RC-600 stereo endpoint;
          Voice Tone Match will not classify the voice until two channels are available.
        </p>
      ) : null}
      {blocked ? (
        <p className="voice-tone-warning">USB Storage is active. Charts remain available, but audio monitoring is disabled.</p>
      ) : null}
      {session.error ? <p className="voice-tone-warning" role="alert">{session.error}</p> : null}
    </section>
  );
}

function IntonationGauge({
  note,
  targetNote,
}: {
  note: DetectedNote | null;
  targetNote: { midi: number; name: string } | null;
}) {
  const targetCents = note && targetNote
    ? (note.midi - targetNote.midi) * 100 + note.cents
    : note?.cents ?? 0;
  const cents = Math.max(-50, Math.min(50, targetCents));
  const position = 50 + cents;
  return (
    <div className="voice-intonation-gauge">
      <div className="voice-intonation-head">
        <span>Intonation</span>
        <strong>
          Target note: {targetNote?.name ?? (note ? `${note.name}${note.octave}` : "—")}
        </strong>
        <span>
          {note ? `${targetCents > 0 ? "+" : ""}${Math.round(targetCents)} cents` : "Waiting for voice"}
        </span>
      </div>
      <div
        className="voice-intonation-track"
        role="meter"
        aria-label="Voice intonation"
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={cents}
      >
        <i className="voice-intonation-center" />
        {note ? <i className="voice-intonation-marker" style={{ left: `${position}%` }} /> : null}
      </div>
      <div className="voice-intonation-scale" aria-hidden="true">
        <span>Flat</span>
        <span>In tune</span>
        <span>Sharp</span>
      </div>
    </div>
  );
}

function ChannelMeter({ label, level }: { label: string; level: number }) {
  return (
    <div className="voice-channel-meter">
      <span>{label}</span>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
        <i style={{ width: `${level * 100}%` }} />
      </div>
    </div>
  );
}
