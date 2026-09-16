import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioInputConstraints,
  audioInputErrorMessage,
  listAudioInputs,
  preferredAudioInput,
} from "./input";

function loadDeviceId(preferenceKey: string): string {
  try {
    const parsed = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}") as { deviceId?: unknown };
    return typeof parsed.deviceId === "string" ? parsed.deviceId : "";
  } catch {
    return "";
  }
}

function saveDeviceId(preferenceKey: string, deviceId: string): void {
  try {
    const current = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(preferenceKey, JSON.stringify({ ...current, deviceId }));
  } catch {
    /* private mode / quota */
  }
}

export function useAudioInputSession({
  preferenceKey,
  blocked = false,
  stereo = false,
}: {
  preferenceKey: string;
  blocked?: boolean;
  stereo?: boolean;
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => loadDeviceId(preferenceKey));
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelCount, setChannelCount] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);

  const stop = useCallback(() => {
    generationRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setStarting(false);
    setChannelCount(0);
  }, []);

  const start = useCallback(
    async (requestedDeviceId = selectedDeviceId) => {
      stop();
      if (blocked) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Audio input is not supported in this browser. Use Chrome or Edge over HTTPS.");
        return;
      }

      const generation = generationRef.current;
      setStarting(true);
      setError(null);
      let nextStream: MediaStream | null = null;
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: audioInputConstraints(requestedDeviceId || undefined, stereo),
        });
        if (generation !== generationRef.current) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const inputs = await listAudioInputs();
        setDevices(inputs);
        const currentId = nextStream.getAudioTracks()[0]?.getSettings().deviceId ?? "";
        const preferred = requestedDeviceId
          ? inputs.find((device) => device.deviceId === requestedDeviceId)
          : preferredAudioInput(inputs);
        if (preferred && preferred.deviceId !== currentId) {
          nextStream.getTracks().forEach((track) => track.stop());
          nextStream = await navigator.mediaDevices.getUserMedia({
            audio: audioInputConstraints(preferred.deviceId, stereo),
          });
        }
        if (generation !== generationRef.current) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const track = nextStream.getAudioTracks()[0];
        const activeDeviceId = track?.getSettings().deviceId ?? preferred?.deviceId ?? "";
        setSelectedDeviceId(activeDeviceId);
        saveDeviceId(preferenceKey, activeDeviceId);
        setChannelCount(track?.getSettings().channelCount ?? 0);
        streamRef.current = nextStream;
        setStream(nextStream);
        setStarting(false);
        track?.addEventListener("ended", stop, { once: true });
      } catch (cause) {
        nextStream?.getTracks().forEach((track) => track.stop());
        if (generation === generationRef.current) {
          setStarting(false);
          setError(audioInputErrorMessage(cause));
        }
      }
    },
    [blocked, preferenceKey, selectedDeviceId, stereo, stop],
  );

  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      saveDeviceId(preferenceKey, deviceId);
      if (streamRef.current) void start(deviceId);
    },
    [preferenceKey, start],
  );

  useEffect(() => {
    void listAudioInputs().then(setDevices);
    const mediaDevices = navigator.mediaDevices;
    const refresh = () => void listAudioInputs().then(setDevices);
    mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, []);

  useEffect(() => {
    if (blocked) stop();
  }, [blocked, stop]);

  useEffect(() => stop, [stop]);

  return {
    supported: Boolean(navigator.mediaDevices?.getUserMedia),
    devices,
    selectedDeviceId,
    selectDevice,
    stream,
    active: Boolean(stream),
    starting,
    error,
    channelCount,
    start,
    stop,
  };
}
