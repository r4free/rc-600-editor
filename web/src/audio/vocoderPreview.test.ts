import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  carrierAudible,
  vocoderBandHz,
  vocoderSensGain,
  vocoderSmoothingHz,
  vocoderTiltDb,
  VOCODER_BANDS,
  oscOctaveSemis,
  oscReleaseSec,
  oscWaveTerms,
} from "./vocoderPreview";
import { OSC_WAVES } from "../components/OscWavePicker";

describe("vocoder preview", () => {
  it("spreads the bands from 150 Hz to 6 kHz", () => {
    assert.equal(Math.round(vocoderBandHz(0)), 150);
    assert.equal(Math.round(vocoderBandHz(VOCODER_BANDS - 1)), 6000);
  });

  it("hears a track carrier always and an input carrier only with Carrier Thru", () => {
    assert.equal(carrierAudible(6, false), true);
    assert.equal(carrierAudible(11, false), true);
    assert.equal(carrierAudible(0, false), false);
    assert.equal(carrierAudible(0, true), true);
  });

  it("maps Attack, Mod Sens and Tone", () => {
    assert.ok(vocoderSmoothingHz(100) < vocoderSmoothingHz(0));
    assert.equal(vocoderSensGain(50), 1);
    assert.equal(vocoderSensGain(100), 4);
    assert.equal(vocoderSensGain(0), 0.25);
    assert.equal(vocoderTiltDb(50), 0);
    assert.equal(vocoderTiltDb(100), 12);
    assert.equal(vocoderTiltDb(0), -12);
  });

  it("maps OSC Voc Octave and Release", () => {
    assert.deepEqual([0, 1, 2, 3].map(oscOctaveSemis), [-24, -12, 0, 12]);
    assert.equal(oscReleaseSec(0), 0.02);
    assert.ok(Math.abs(oscReleaseSec(100) - 2) < 1e-9);
    assert.ok(oscReleaseSec(50) > oscReleaseSec(0) && oscReleaseSec(50) < oscReleaseSec(100));
  });

  it("builds the Vintage Saw and Rect waves", () => {
    const saw = oscWaveTerms(0, 16);
    const vintage = oscWaveTerms(1, 16);
    assert.equal(vintage.imag[1]!.toFixed(3), (saw.imag[1]! / (1 + 1 / 64)).toFixed(3));
    assert.ok(Math.abs(vintage.imag[12]!) < Math.abs(saw.imag[12]!) / 2);
    const rect = oscWaveTerms(4, 16);
    assert.ok(Math.abs(rect.real[5]!) < 1e-6);
    assert.ok(rect.imag[1]! > 0);
  });

  it("draws one wave per OSC Carrier option", () => {
    assert.equal(OSC_WAVES.length, 5);
  });
});
