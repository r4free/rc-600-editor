import { useCallback, useEffect, useRef, useState } from "react";
import {
  hitsToStepSet,
  resolvePadTiming,
  stepIntervalSec,
  type PadTimingOverride,
  type TimingConfig,
} from "./drumLoop";

const SCHEDULE_AHEAD_SEC = 0.12;
const LOOKAHEAD_MS = 25;
const NOTE_OFF_SEC = 0.09;

type FireNote = (midiNote: number, velocity: number, down: boolean) => void;

interface VoiceState {
  playing: boolean;
  nextStepTime: number;
  nextStepIndex: number;
  bpm: number;
  meter: string;
  activeSteps: Set<number>;
}

/**
 * Loop engine keyed by pad slot id (0…15).
 * MIDI note is resolved at fire time via padNotes so instruments can change live.
 */
export function usePadLoopEngine({
  open,
  padIds,
  padNotes,
  globalTiming,
  padOverrides,
  velocity,
  onDrumNote,
}: {
  open: boolean;
  padIds: readonly number[];
  /** slot → MIDI note */
  padNotes: readonly number[];
  globalTiming: TimingConfig;
  padOverrides: Record<number, PadTimingOverride>;
  velocity: number;
  onDrumNote: FireNote;
}) {
  const [playingPads, setPlayingPads] = useState<Set<number>>(() => new Set());
  const voicesRef = useRef(new Map<number, VoiceState>());
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offTimersRef = useRef(new Map<number, number>());

  const globalRef = useRef(globalTiming);
  const overridesRef = useRef(padOverrides);
  const velocityRef = useRef(velocity);
  const onDrumNoteRef = useRef(onDrumNote);
  const padIdsRef = useRef(padIds);
  const padNotesRef = useRef(padNotes);
  globalRef.current = globalTiming;
  overridesRef.current = padOverrides;
  velocityRef.current = velocity;
  onDrumNoteRef.current = onDrumNote;
  padIdsRef.current = padIds;
  padNotesRef.current = padNotes;

  const midiFor = useCallback((padId: number) => {
    const n = padNotesRef.current[padId];
    return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(127, n)) : 36;
  }, []);

  const ensureCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }, []);

  const syncPlayingState = useCallback(() => {
    const next = new Set<number>();
    for (const [padId, v] of voicesRef.current) {
      if (v.playing) next.add(padId);
    }
    setPlayingPads(next);
  }, []);

  const clearNoteOff = useCallback((padId: number) => {
    const t = offTimersRef.current.get(padId);
    if (t != null) {
      clearTimeout(t);
      offTimersRef.current.delete(padId);
    }
  }, []);

  const fireHit = useCallback(
    (padId: number, whenAudio: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const midi = midiFor(padId);
      const delayMs = Math.max(0, (whenAudio - ctx.currentTime) * 1000);
      window.setTimeout(() => {
        onDrumNoteRef.current(midi, velocityRef.current, true);
        clearNoteOff(padId);
        const off = window.setTimeout(() => {
          onDrumNoteRef.current(midi, 0, false);
          offTimersRef.current.delete(padId);
        }, NOTE_OFF_SEC * 1000);
        offTimersRef.current.set(padId, off);
      }, delayMs);
    },
    [clearNoteOff, midiFor],
  );

  const stopScheduler = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refreshVoiceTiming = useCallback((padId: number, voice: VoiceState, now: number) => {
    const ov = overridesRef.current[padId];
    const timing = resolvePadTiming(globalRef.current, ov);
    const hits = ov?.hitsPerBar ?? 0;
    voice.activeSteps = hitsToStepSet(hits);
    if (timing.bpm !== voice.bpm || timing.meter !== voice.meter) {
      voice.bpm = timing.bpm;
      voice.meter = timing.meter;
      voice.nextStepTime = Math.max(voice.nextStepTime, now);
    }
  }, []);

  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const horizon = now + SCHEDULE_AHEAD_SEC;

    for (const [padId, voice] of voicesRef.current) {
      if (!voice.playing) continue;
      refreshVoiceTiming(padId, voice, now);
      const timing = resolvePadTiming(globalRef.current, overridesRef.current[padId]);
      const interval = stepIntervalSec(timing);
      while (voice.nextStepTime < horizon) {
        if (voice.nextStepTime >= now - 0.001 && voice.activeSteps.has(voice.nextStepIndex)) {
          fireHit(padId, voice.nextStepTime);
        }
        voice.nextStepIndex = (voice.nextStepIndex + 1) % 16;
        voice.nextStepTime += interval;
      }
    }
  }, [fireHit, refreshVoiceTiming]);

  const startScheduler = useCallback(() => {
    ensureCtx();
    if (timerRef.current != null) return;
    timerRef.current = setInterval(tick, LOOKAHEAD_MS);
  }, [ensureCtx, tick]);

  const stopAll = useCallback(() => {
    for (const voice of voicesRef.current.values()) {
      voice.playing = false;
    }
    for (const padId of offTimersRef.current.keys()) {
      clearNoteOff(padId);
      onDrumNoteRef.current(midiFor(padId), 0, false);
    }
    offTimersRef.current.clear();
    stopScheduler();
    syncPlayingState();
  }, [clearNoteOff, midiFor, stopScheduler, syncPlayingState]);

  const armVoice = useCallback((padId: number, origin: number) => {
    const ov = overridesRef.current[padId];
    const timing = resolvePadTiming(globalRef.current, ov);
    const hits = ov?.hitsPerBar ?? 0;
    voicesRef.current.set(padId, {
      playing: true,
      nextStepTime: origin,
      nextStepIndex: 0,
      bpm: timing.bpm,
      meter: timing.meter,
      activeSteps: hitsToStepSet(hits),
    });
  }, []);

  const setPadPlaying = useCallback(
    (padId: number, playing: boolean) => {
      const ctx = ensureCtx();
      const now = ctx.currentTime;
      if (playing) {
        armVoice(padId, now);
        startScheduler();
      } else {
        const voice = voicesRef.current.get(padId);
        if (voice) voice.playing = false;
        clearNoteOff(padId);
        onDrumNoteRef.current(midiFor(padId), 0, false);
        const any = [...voicesRef.current.values()].some((v) => v.playing);
        if (!any) stopScheduler();
      }
      syncPlayingState();
    },
    [armVoice, clearNoteOff, ensureCtx, midiFor, startScheduler, stopScheduler, syncPlayingState],
  );

  const togglePad = useCallback(
    (padId: number) => {
      const voice = voicesRef.current.get(padId);
      setPadPlaying(padId, !(voice?.playing ?? false));
    },
    [setPadPlaying],
  );

  const playAll = useCallback(() => {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    startScheduler();
    for (const padId of padIdsRef.current) {
      armVoice(padId, now);
    }
    syncPlayingState();
  }, [armVoice, ensureCtx, startScheduler, syncPlayingState]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [padId, voice] of voicesRef.current) {
      if (!voice.playing) continue;
      refreshVoiceTiming(padId, voice, now);
    }
  }, [globalTiming, padOverrides, refreshVoiceTiming]);

  useEffect(() => {
    if (open) return;
    stopAll();
    void ctxRef.current?.close().catch(() => {
      /* ignore */
    });
    ctxRef.current = null;
  }, [open, stopAll]);

  useEffect(() => {
    return () => {
      stopAll();
      void ctxRef.current?.close().catch(() => {
        /* ignore */
      });
      ctxRef.current = null;
    };
  }, [stopAll]);

  return {
    playingPads,
    isPlaying: (padId: number) => playingPads.has(padId),
    togglePad,
    setPadPlaying,
    playAll,
    stopAll,
  };
}
