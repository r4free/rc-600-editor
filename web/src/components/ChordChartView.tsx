import type { SetlistScrollGuide } from "../presets/playlist";
import { parseSongMusic, transposeSongSource } from "../setlists/chordChart";

export function ChordChartView({
  music,
  className = "",
  activeLine = null,
  activeChord = null,
}: {
  music: SetlistScrollGuide;
  className?: string;
  activeLine?: number | null;
  activeChord?: string | null;
}) {
  const source = transposeSongSource(music.format, music.source, music.transpose, music.key);
  const parsed = parseSongMusic(music.format, source);

  if (music.format === "chords") {
    return (
      <div className={`chord-progression ${className}`.trim()}>
        {source.split(/\s*\|\s*|\s+/).filter(Boolean).map((chord, index) => (
          <span key={`${chord}-${index}`}>{chord}</span>
        ))}
      </div>
    );
  }

  let musicalLine = 0;
  return (
    <div className={`chord-chart ${className}`.trim()}>
      {parsed.lines.map((line, lineIndex) => {
        if (line.kind === "blank") return <div className="chord-chart-blank" key={lineIndex} />;
        if (line.kind === "section") {
          return <h3 className="chord-chart-section" key={lineIndex}>{line.label}</h3>;
        }
        if (line.kind === "literal") {
          musicalLine += 1;
          const lineNumber = musicalLine;
          return (
            <div
              className={`chord-chart-literal${activeLine === lineNumber ? " is-active" : ""}`}
              data-chart-line={lineNumber}
              key={lineIndex}
            >
              {line.text}
            </div>
          );
        }
        musicalLine += 1;
        const lineNumber = musicalLine;
        return (
          <div
            className={`chord-chart-line${activeLine === lineNumber ? " is-active" : ""}`}
            data-chart-line={lineNumber}
            key={lineIndex}
          >
            {line.segments.map((segment, segmentIndex) => (
              <span
                className={`chord-chart-segment${
                  activeLine === lineNumber && segment.chord === activeChord ? " is-current-chord" : ""
                }`}
                key={segmentIndex}
              >
                <b>{segment.chord ?? "\u00a0"}</b>
                <span>{segment.text || "\u00a0"}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
