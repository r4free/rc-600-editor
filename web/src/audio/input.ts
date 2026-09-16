import { isLikelyRc600 } from "@rc600/midi/rc600-midi";

export function preferredAudioInput(
  devices: readonly MediaDeviceInfo[],
): MediaDeviceInfo | undefined {
  return (
    devices.find((device) => isLikelyRc600(device.label)) ??
    devices.find((device) => /boss|roland/i.test(device.label)) ??
    devices[0]
  );
}

export function audioInputConstraints(
  deviceId?: string,
  stereo = false,
): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    ...(stereo ? { channelCount: { ideal: 2 } } : {}),
    echoCancellation: false,
    autoGainControl: false,
    noiseSuppression: false,
  };
}

export function audioInputErrorMessage(error: unknown): string {
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

export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter(
    (device) => device.kind === "audioinput",
  );
}
