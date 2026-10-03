# RC-600 model in the editor

Open **3D Model** beside **Chain** in Memory. The panels can be shown independently.
The model supports drag rotation, arrow-key rotation, +/− zoom, and Perspective,
Panel and Rear camera presets. Camera state never writes parameters or sends MIDI.

The photo-textured CSS geometry and `web/public/rc600-model` photographs were
reused from the original model in worktree `92d2/rc-600`. The integrated component
is `web/src/components/Rc600Model.tsx`; styles use the editor's existing theme.
No new dependencies, standalone demo configuration or hotspot registry were imported.

This is approximate geometry with photos, not a CAD/GLB scan. Knobs and sockets
remain part of the photographs. Hotspots and navigation from the model are deferred.

The breadcrumb follows an explicit hierarchy of currently mounted tablists,
including conditional tracks, routing and EQ channels. It uses the actual rendered
labels, so stereo-linked channels match the editor. Previous levels focus and
reveal that level's tabs: there is no separate overview page for those ancestors.
It does not select a different memory, reset nested tab choices, save files, or
send pedal commands.
