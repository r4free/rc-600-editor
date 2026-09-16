# Voice Tone Match hardware verification

## Verified in software

- Setlist v1/v2 migration and v3 import/export.
- ChordPro parsing, chord-only progressions, key transposition, and live chart rendering.
- Stable vocal-note filtering, scale-degree classification, and rolling key compatibility.
- Audio processing is disabled at capture and a stereo stream is requested.
- Monitoring stops on view close, song change, device change, USB Storage activation, and unmount.
- Chrome/Edge exposed the connected `RC-600 USB Audio` endpoint as two channels on September 16, 2026.

## RC-600 checks still required with live signals

1. Set the RC-600 USB audio mode and routing required for a stereo computer input.
2. Route harmony/reference audio to Left and isolated voice to Right.
3. Start monitoring from a song with Voice Tone Match enabled.
4. Play harmony only and confirm only the Left meter responds.
5. Sing only and confirm only the Right meter responds and stable notes appear.
6. Use **Swap channels** if the routing is reversed.
7. Check microphone bleed into the harmony channel and instrument bleed into the voice channel.
8. Disconnect and reconnect USB, then confirm the selected endpoint can be opened again.
9. Activate USB Storage and confirm the chart stays open while audio monitoring stops.

Automatic chord recognition from the Harmony Reference channel is not part of this version. The
channel is used only for routing and level diagnostics.
