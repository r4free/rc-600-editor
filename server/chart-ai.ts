export interface GeneratedChart {
  kind: "chart" | "chords";
  source: string;
  suggestedKey: string;
  mode: "major" | "minor";
  title?: string;
  artist?: string;
  durationSeconds?: number;
}

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "openai" | "google-ai-studio" | "custom";
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

export function chartLlmConfig(): LlmConfig {
  const apiKey =
    process.env.RC600_LLM_API_KEY?.trim() ||
    process.env.VG800_LLM_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "";
  const baseOverride =
    process.env.RC600_LLM_BASE_URL?.trim() ||
    process.env.VG800_LLM_BASE_URL?.trim();
  const modelOverride =
    process.env.RC600_LLM_MODEL?.trim() ||
    process.env.VG800_LLM_MODEL?.trim();
  const keyProvider = /^sk-/i.test(apiKey)
    ? "openai"
    : /^AIza/i.test(apiKey)
      ? "google-ai-studio"
      : null;
  const provider = baseOverride
    ? baseOverride.includes("generativelanguage.googleapis.com")
      ? "google-ai-studio"
      : baseOverride.includes("openai.com")
        ? "openai"
        : "custom"
    : keyProvider ?? (process.env.OPENAI_API_KEY ? "openai" : "google-ai-studio");
  const baseUrl =
    baseOverride?.replace(/\/$/, "") ||
    (provider === "openai" ? OPENAI_BASE_URL : GEMINI_BASE_URL);
  const model =
    modelOverride ||
    (provider === "openai" ? "gpt-4o-mini" : "gemini-3.6-flash");
  return { apiKey, baseUrl, model, provider };
}

const SYSTEM_PROMPT = `You format music chord charts for the RC-600 Setlist editor.
Return one JSON object only, with this exact shape:
{"kind":"chart","source":"...","suggestedKey":"C","mode":"major","title":"...","artist":"...","durationSeconds":240}

Formatting rules:
- kind is "chart" when lyrics/sections are present, otherwise "chords".
- chart source is a ChordPro subset. Put metadata first using {title: }, {artist: }, {key: }, {capo: }, {tempo: }, and {time: } when known.
- Use {start_of_verse: Verse 1}, {start_of_chorus: Chorus}, {start_of_bridge: Bridge}, and matching end directives.
- Chords must be inline immediately before their lyric syllable, for example [D/F#]word.
- Chords-only source is a plain progression such as C | G/B | Am7 | F.
- Use ASCII # and b accidentals. Preserve chord qualities, extensions, and slash bass notes.
- Return the complete lyrics and chords when they are known. Never return only a short excerpt when the user requested the full song.
- Include approximate durationSeconds when known. Exact musical timing comes from imported score files, not from AI.
- Do not use Markdown fences, HTML, commentary, tablature, or any format outside the JSON.
- Do not claim uncertain song details as facts. If the request lacks enough information, produce the best useful chord-only outline and omit unknown metadata.
- suggestedKey is a key suggestion only; the user confirms it in the editor.`;

function jsonObject(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI returned no chart data");
  return JSON.parse(unfenced.slice(start, end + 1));
}

export function parseGeneratedChart(raw: unknown): GeneratedChart {
  if (!raw || typeof raw !== "object") throw new Error("AI returned invalid chart data");
  const value = raw as Record<string, unknown>;
  const source = typeof value.source === "string"
    ? value.source.replace(/\r\n?/g, "\n").trim().slice(0, 100_000)
    : "";
  if (!source) throw new Error("AI returned an empty chart");
  const kind = value.kind === "chords" ? "chords" : "chart";
  const suggestedKey =
    typeof value.suggestedKey === "string" &&
    /^[A-G](?:#|b)?$/.test(value.suggestedKey.trim())
      ? value.suggestedKey.trim()
      : "";
  const optionalText = (input: unknown) =>
    typeof input === "string" && input.trim() ? input.trim().slice(0, 200) : undefined;
  const durationSeconds = Number(value.durationSeconds);
  return {
    kind,
    source,
    suggestedKey,
    mode: value.mode === "minor" ? "minor" : "major",
    ...(optionalText(value.title) ? { title: optionalText(value.title) } : {}),
    ...(optionalText(value.artist) ? { artist: optionalText(value.artist) } : {}),
    ...(Number.isFinite(durationSeconds) && durationSeconds >= 15 && durationSeconds <= 3_600
      ? { durationSeconds: Math.round(durationSeconds) }
      : {}),
  };
}

export async function generateChartWithAi(prompt: string): Promise<{
  chart: GeneratedChart;
  model: string;
  provider: string;
}> {
  const config = chartLlmConfig();
  if (!config.apiKey) {
    throw new Error("AI is not configured on this server");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    type Message = { role: "system" | "user" | "assistant"; content: string };
    const request = (messages: Message[], jsonMode: boolean) =>
      fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          max_tokens: 12_000,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          messages,
        }),
      });

    const complete = async (messages: Message[]) => {
      let response = await request(messages, true);
      let responseText = await response.text();
      if (!response.ok && response.status === 400 && /response_format|json/i.test(responseText)) {
        response = await request(messages, false);
        responseText = await response.text();
      }
      const payload = (() => {
        try {
          return JSON.parse(responseText) as {
            choices?: Array<{ message?: { content?: string } }>;
            error?: { message?: string };
          };
        } catch {
          return null;
        }
      })() as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message?: string };
        } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || `AI request failed (${response.status})`);
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI returned no chart");
      return content;
    };

    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ];
    const content = await complete(messages);
    const chart = parseGeneratedChart(jsonObject(content));
    return {
      chart,
      model: config.model,
      provider: config.provider,
    };
  } finally {
    clearTimeout(timeout);
  }
}
