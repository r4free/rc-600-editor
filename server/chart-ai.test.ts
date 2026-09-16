import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  chartLlmConfig,
  parseGeneratedChart,
} from "./chart-ai";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("setlist chart AI", () => {
  it("normalizes generated ChordPro without confirming the suggested key", () => {
    assert.deepEqual(parseGeneratedChart({
      kind: "chart",
      source: "{title: Test}\r\n{key: G}\r\n[G]Hello [D/F#]world",
      suggestedKey: "G",
      mode: "major",
      title: "Test",
      durationSeconds: 180,
    }), {
      kind: "chart",
      source: "{title: Test}\n{key: G}\n[G]Hello [D/F#]world",
      suggestedKey: "G",
      mode: "major",
      title: "Test",
      durationSeconds: 180,
    });
  });

  it("rejects empty AI responses and invalid key suggestions", () => {
    assert.throws(() => parseGeneratedChart({ kind: "chart", source: "" }), /empty chart/i);
    assert.equal(parseGeneratedChart({
      kind: "chords",
      source: "Am | F | C | G",
      suggestedKey: "H",
      mode: "minor",
    }).suggestedKey, "");
  });

  it("uses the VG production provider and model defaults", () => {
    delete process.env.RC600_LLM_API_KEY;
    delete process.env.VG800_LLM_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.RC600_LLM_BASE_URL;
    delete process.env.RC600_LLM_MODEL;
    const config = chartLlmConfig();
    assert.equal(config.provider, "openai");
    assert.equal(config.model, "gpt-4o-mini");
    assert.match(config.baseUrl, /api\.openai\.com/);
  });
});
