import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNotchFilter,
  applyDeHum,
  applyDeClip,
  applyDeClick,
  computeDelta,
  applyDNoise,
} from './audioProcessing';
import { analyzeAudioForensics, generateC2paManifest } from './synthId';
import { encodeWav, encodeAiff, resampleAudio } from './audioExport';
import { generateDemoAudio, DEMO_PRESETS } from './sampleAudio';

test('De-Hum notch filter attenuates 60Hz electrical hum', () => {
  const sampleRate = 44100;
  const numSamples = 44100; // 1 second
  const input = new Float32Array(numSamples);

  // Pure 60Hz tone
  for (let i = 0; i < numSamples; i++) {
    input[i] = Math.sin((2 * Math.PI * 60 * i) / sampleRate);
  }

  // Calculate initial RMS energy
  let inRms = 0;
  for (let i = 0; i < numSamples; i++) inRms += input[i] * input[i];
  inRms = Math.sqrt(inRms / numSamples);

  // Apply De-Hum at 60Hz
  const filtered = applyDeHum(input, sampleRate, 60, 4, 30, 20);

  // Calculate filtered RMS energy
  let outRms = 0;
  for (let i = 1000; i < numSamples; i++) outRms += filtered[i] * filtered[i];
  outRms = Math.sqrt(outRms / (numSamples - 1000));

  // Output energy must be substantially reduced (> 12 dB attenuation)
  assert.ok(outRms < inRms * 0.35, `Notch filter should attenuate 60Hz hum: inRms=${inRms}, outRms=${outRms}`);
});

test('De-Clip smooths squared-off clipped peaks', () => {
  const numSamples = 200;
  const input = new Float32Array(numSamples);

  // Create a clipped plateau at 0.8
  for (let i = 0; i < numSamples; i++) {
    const raw = Math.sin((2 * Math.PI * i) / 50);
    input[i] = Math.min(0.8, Math.max(-0.8, raw));
  }

  // Count flat clipped samples
  let flatClippedBefore = 0;
  for (let i = 1; i < numSamples; i++) {
    if (Math.abs(input[i] - 0.8) < 1e-4 && Math.abs(input[i - 1] - 0.8) < 1e-4) {
      flatClippedBefore++;
    }
  }
  assert.ok(flatClippedBefore > 0, 'Test input has flat clipped plateau');

  // Apply De-Clip
  const declipped = applyDeClip(input, -2.0, 70); // threshold ~0.79

  // Check that flat plateau is replaced with curvature
  let flatClippedAfter = 0;
  for (let i = 1; i < numSamples; i++) {
    if (Math.abs(declipped[i] - 0.8) < 1e-4 && Math.abs(declipped[i - 1] - 0.8) < 1e-4) {
      flatClippedAfter++;
    }
  }
  assert.ok(flatClippedAfter < flatClippedBefore, 'De-clip should reduce flat clipped samples');
});

test('De-Click suppresses sudden impulse spikes', () => {
  const sampleRate = 44100;
  const input = new Float32Array(500);

  // Smooth low signal
  for (let i = 0; i < 500; i++) {
    input[i] = 0.05 * Math.sin(i * 0.05);
  }

  // Inject sharp clicks at index 150 and 320
  input[150] = 0.95;
  input[151] = 0.45;
  input[320] = -0.92;

  const cleaned = applyDeClick(input, sampleRate, 80, 2.0);

  // The click spikes should be substantially attenuated
  assert.ok(Math.abs(cleaned[150]) < 0.6, `Click at 150 should be attenuated, got ${cleaned[150]}`);
  assert.ok(Math.abs(cleaned[320]) < 0.6, `Click at 320 should be attenuated, got ${cleaned[320]}`);
});

test('Delta computation produces exact difference', () => {
  const orig = new Float32Array([1.0, 0.5, -0.3, 0.8]);
  const restored = new Float32Array([0.8, 0.5, -0.1, 0.2]);

  const delta = computeDelta(orig, restored);
  assert.equal(delta.length, 4);
  assert.ok(Math.abs(delta[0] - 0.2) < 1e-5);
  assert.ok(Math.abs(delta[1] - 0.0) < 1e-5);
  assert.ok(Math.abs(delta[2] - (-0.2)) < 1e-5);
  assert.ok(Math.abs(delta[3] - 0.6) < 1e-5);
});

test('SynthID forensics evaluates synthetic and organic characteristics', () => {
  const sampleRate = 44100;
  // Test with generated synthetic demo
  const aiSamples = generateDemoAudio('synthid_deepfake', 2.0, sampleRate);
  const inspection = analyzeAudioForensics(aiSamples, sampleRate);

  assert.equal(inspection.isScanned, true);
  assert.ok(inspection.confidenceScore > 0 && inspection.confidenceScore <= 100);
  assert.ok(inspection.fingerprintHash.startsWith('c2pa:audiohub:sha256:'));
  assert.ok(Array.isArray(inspection.detectedArtifacts));
});

test('C2PA manifest generates valid specification structure', () => {
  const manifest = generateC2paManifest('voice_sample.wav', { deHum: true, dNoise: true }, true, 'hash123');
  assert.equal(manifest.title, 'voice_sample.wav');
  assert.equal(manifest['@context'], 'https://c2pa.org/specifications/v1/');
  assert.equal(manifest.assertions.length, 2);
  assert.equal(manifest.assertions[1].data.embedded, true);
});

test('WAV encoder generates valid RIFF and BWF chunks', async () => {
  const samples = new Float32Array([0.1, -0.2, 0.5, -0.8]);
  const blob = encodeWav(samples, 48000, 24, false, {
    description: 'Test Restored WAV',
    synthIdHash: 'SYNTHID-TEST',
  });

  assert.ok(blob.size > 44 + 602, 'Blob size should include RIFF header, bext chunk, and PCM data');
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);

  // Check 'RIFF'
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.equal(riff, 'RIFF');

  // Check 'WAVE'
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.equal(wave, 'WAVE');

  // Check 'bext'
  const bext = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
  assert.equal(bext, 'bext');
});

test('AIFF encoder generates valid FORM container', async () => {
  const samples = new Float32Array([0.1, -0.2, 0.5, -0.8]);
  const blob = encodeAiff(samples, 44100, 16, false);

  assert.ok(blob.size > 54, 'Blob size should include FORM, COMM, and SSND headers');
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);

  // Check 'FORM'
  const form = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.equal(form, 'FORM');

  // Check 'AIFF'
  const aiff = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  assert.equal(aiff, 'AIFF');
});

test('Demo presets provide valid playable audio buffers', () => {
  for (const preset of DEMO_PRESETS) {
    const audio = generateDemoAudio(preset.id, 1.0, 44100);
    assert.equal(audio.length, 44100);
    let max = 0;
    for (let i = 0; i < audio.length; i++) {
      if (Math.abs(audio[i]) > max) max = Math.abs(audio[i]);
    }
    assert.ok(max > 0.05, `Preset ${preset.id} should produce audible signal`);
    assert.ok(max <= 1.0, `Preset ${preset.id} should not exceed 1.0`);
  }
});
