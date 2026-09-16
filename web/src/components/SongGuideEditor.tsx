import { useRef, useState } from "react";
import { generateSetlistChart, type AiLimits } from "../api";
import type {
  SetlistScoreGuide,
  SetlistScrollGuide,
  SetlistSong,
  SetlistSongMusic,
  SongKeyMode,
} from "../presets/playlist";
import { parseSongMusic, suggestKeys, transposeKeyRoot } from "../setlists/chordChart";
import { scoreAssetStore } from "../setlists/scoreAssetStore";
import { ChordChartView } from "./ChordChartView";

const KEY_ROOTS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const SCORE_EXTENSIONS = /\.(?:gp|gpx|gp[3-5]|musicxml|xml|mxl)$/i;

function emptyScrollGuide(): SetlistScrollGuide {
  return {
    kind: "scroll",
    format: "chart",
    source: "",
    key: "",
    mode: "major",
    transpose: 0,
    autoScrollSeconds: 240,
  };
}

export function SetlistSongMusicEditor({
  song,
  onChange,
}: {
  song: SetlistSong;
  onChange: (song: SetlistSong) => void;
}) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLimits, setAiLimits] = useState<AiLimits | null>(null);
  const [assetBusy, setAssetBusy] = useState(false);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const music = song.music;
  const scroll = music?.kind === "scroll" ? music : null;
  const score = music?.kind === "score" ? music : null;
  const parsed = scroll ? parseSongMusic(scroll.format, scroll.source) : null;
  const suggestions = parsed ? suggestKeys(parsed.chords) : [];

  const setMusic = (next: SetlistSongMusic) => {
    onChange({
      ...song,
      music: next,
      voiceToneMatch: song.voiceToneMatch ?? { enabled: false },
    });
  };

  const updateMusic = (patch: Partial<SetlistSongMusic>) => {
    if (!music) return;
    setMusic({ ...music, ...patch } as SetlistSongMusic);
  };

  const generateWithAi = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await generateSetlistChart(prompt);
      setAiLimits(result.limits);
      setMusic({
        kind: "scroll",
        format: result.chart.kind,
        source: result.chart.source,
        key: result.chart.suggestedKey,
        mode: result.chart.mode,
        transpose: 0,
        autoScrollSeconds: result.chart.durationSeconds ?? 240,
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not generate the chart");
    } finally {
      setAiBusy(false);
    }
  };

  const importScore = async (file: File) => {
    if (!SCORE_EXTENSIONS.test(file.name)) {
      setAiError("Choose a Guitar Pro or MusicXML score");
      return;
    }
    if (file.size > 100_000_000) {
      setAiError("Score files must be smaller than 100 MB");
      return;
    }
    setAssetBusy(true);
    setAiError(null);
    try {
      const asset = await scoreAssetStore.put(
        file.name,
        new Uint8Array(await file.arrayBuffer()),
        file.type || "application/octet-stream",
      );
      const next: SetlistScoreGuide = {
        kind: "score",
        assetId: asset.id,
        fileName: asset.fileName,
        byteLength: asset.bytes.byteLength,
        selectedTrackIndexes: [],
        key: music?.key ?? "",
        mode: music?.mode ?? "major",
        transpose: 0,
        metronome: true,
        countIn: true,
        scoreAudio: false,
        playbackSpeed: 1,
      };
      setMusic(next);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not store the score");
    } finally {
      setAssetBusy(false);
    }
  };

  return (
    <section className="song-music-editor">
      <div className="song-music-editor-head">
        <strong>Music guide</strong>
        <div className="song-guide-actions">
          <button
            type="button"
            className={`btn ${scroll ? "primary" : "ghost"}`}
            onClick={() => setMusic(scroll ?? emptyScrollGuide())}
          >
            Scrolling chart
          </button>
          <button
            type="button"
            className={`btn ${score ? "primary" : "ghost"}`}
            disabled={assetBusy}
            onClick={() => scoreInputRef.current?.click()}
          >
            {assetBusy ? "Importing…" : score ? "Replace score" : "Import score"}
          </button>
          <input
            ref={scoreInputRef}
            className="playlist-file-input"
            type="file"
            accept=".gp,.gpx,.gp3,.gp4,.gp5,.musicxml,.xml,.mxl"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importScore(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="song-chart-ai">
        <label className="playlist-field">
          <span>Format lyrics and chords with AI</span>
          <div className="song-chart-ai-row">
            <textarea
              rows={3}
              maxLength={20_000}
              value={aiPrompt}
              disabled={aiBusy}
              placeholder="Paste complete lyrics or a chord chart, then add title, artist, version, and preferred key…"
              onChange={(event) => setAiPrompt(event.target.value)}
            />
            <button
              type="button"
              className="btn"
              disabled={aiBusy || !aiPrompt.trim()}
              onClick={() => void generateWithAi()}
            >
              {aiBusy ? "Formatting…" : "Format chart"}
            </button>
          </div>
        </label>
        {aiLimits && !aiLimits.unlimited ? (
          <p className="song-chart-ai-status">
            {aiLimits.remainingToday ?? 0} of {aiLimits.limitPerDay ?? 0} AI generations remaining today.
          </p>
        ) : null}
        {aiError ? <p className="song-chart-ai-error" role="alert">{aiError}</p> : null}
      </div>

      {music ? (
        <>
          <div className="song-music-fields">
            <label className="playlist-field">
              <span>Confirmed key</span>
              <select value={music.key} onChange={(event) => updateMusic({ key: event.target.value })}>
                <option value="">Choose key…</option>
                {KEY_ROOTS.map((root) => <option key={root} value={root}>{root}</option>)}
              </select>
            </label>
            <label className="playlist-field">
              <span>Mode</span>
              <select
                value={music.mode}
                onChange={(event) => updateMusic({ mode: event.target.value as SongKeyMode })}
              >
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </label>
            {scroll ? (
              <>
                <label className="playlist-field">
                  <span>Scroll duration (seconds)</span>
                  <input
                    type="number"
                    min={15}
                    max={3600}
                    value={scroll.autoScrollSeconds ?? ""}
                    onChange={(event) =>
                      updateMusic({
                        autoScrollSeconds: event.target.value
                          ? Math.max(15, Math.min(3600, Number(event.target.value)))
                          : undefined,
                      })
                    }
                  />
                </label>
                <div className="playlist-field">
                  <span>Transpose</span>
                  <div className="song-transpose">
                    <button type="button" className="btn ghost" onClick={() => updateMusic({ transpose: Math.max(-12, music.transpose - 1) })}>−</button>
                    <b>{music.transpose > 0 ? `+${music.transpose}` : music.transpose}</b>
                    <button type="button" className="btn ghost" onClick={() => updateMusic({ transpose: Math.min(12, music.transpose + 1) })}>+</button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {scroll && suggestions.length && !scroll.key ? (
            <div className="song-key-suggestions">
              <span>Suggested keys</span>
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  className="btn ghost"
                  key={`${suggestion.root}-${suggestion.mode}`}
                  onClick={() => updateMusic({ key: suggestion.root, mode: suggestion.mode })}
                >
                  {suggestion.root} {suggestion.mode}
                </button>
              ))}
            </div>
          ) : null}

          {scroll ? (
            <>
              <details className="song-music-source">
                <summary>Source</summary>
                <textarea
                  rows={scroll.format === "chart" ? 10 : 3}
                  value={scroll.source}
                  spellCheck={false}
                  onChange={(event) => updateMusic({ source: event.target.value })}
                />
              </details>
              {scroll.source.trim() ? (
                <details className="song-music-preview">
                  <summary>Preview</summary>
                  <ChordChartView music={scroll} />
                </details>
              ) : null}
            </>
          ) : null}

          {score ? (
            <div className="song-score-settings">
              <div>
                <span>Score file</span>
                <strong>{score.fileName}</strong>
                <small>{(score.byteLength / 1_048_576).toFixed(1)} MB</small>
              </div>
              <Toggle label="Metronome" checked={score.metronome} onChange={(metronome) => updateMusic({ metronome })} />
              <Toggle label="Count in" checked={score.countIn} onChange={(countIn) => updateMusic({ countIn })} />
              <Toggle label="Score audio" checked={score.scoreAudio} onChange={(scoreAudio) => updateMusic({ scoreAudio })} />
              <label className="playlist-field">
                <span>Playback speed</span>
                <select value={score.playbackSpeed} onChange={(event) => updateMusic({ playbackSpeed: Number(event.target.value) })}>
                  {[0.5, 0.75, 1, 1.25, 1.5].map((speed) => <option key={speed} value={speed}>{Math.round(speed * 100)}%</option>)}
                </select>
              </label>
            </div>
          ) : null}

          <label className="playlist-field song-music-source">
            <span>Performance notes</span>
            <textarea
              rows={2}
              value={music.performanceNotes ?? ""}
              onChange={(event) => updateMusic({ performanceNotes: event.target.value })}
            />
          </label>

          <div className="song-music-summary">
            <span>
              {music.kind === "score"
                ? "Exact score timing"
                : `${parsed?.chords.length ?? 0} chords · ${music.autoScrollSeconds ?? 0}s scroll`}
            </span>
            <span>
              {music.key
                ? `Live key: ${transposeKeyRoot(music.key, music.transpose)} ${music.mode}`
                : "Confirm a key for Voice Tone Match"}
            </span>
            <button
              type="button"
              role="switch"
              className={`power-switch${song.voiceToneMatch?.enabled ? " on" : ""}`}
              aria-checked={Boolean(song.voiceToneMatch?.enabled)}
              disabled={!music.key}
              onClick={() => onChange({
                ...song,
                voiceToneMatch: { enabled: !song.voiceToneMatch?.enabled },
              })}
            >
              <span className="power-switch-track"><span className="power-switch-thumb" /></span>
              <span className="power-switch-state">
                {song.voiceToneMatch?.enabled ? "Voice Tone Match ON" : "Voice Tone Match OFF"}
              </span>
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={`power-switch${checked ? " on" : ""}`}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="power-switch-track"><span className="power-switch-thumb" /></span>
      <span className="power-switch-state">{label} {checked ? "ON" : "OFF"}</span>
    </button>
  );
}
