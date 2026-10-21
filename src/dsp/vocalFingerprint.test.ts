import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVocalRange,
  createSpeakerProfile,
  generateSpeakerFrequencyPoints,
  extractVocalFingerprints,
} from './vocalFingerprint';
import { generateDemoAudio } from './sampleAudio';

test('classifyVocalRange correctly categorizes human pitch registers', () => {
  assert.equal(classifyVocalRange(95), 'Bass / Low Voice');
  assert.equal(classifyVocalRange(140), 'Baritone / Low-Tenor');
  assert.equal(classifyVocalRange(190), 'Tenor / Alto');
  assert.equal(classifyVocalRange(260), 'Mezzo-Soprano / Child');
});

test('createSpeakerProfile builds complete harmonic overtones and formants', () => {
  const profile = createSpeakerProfile('spk-test', 'Test Speaker', '#06b6d4', 150, [
    { startSec: 0, endSec: 2 },
  ]);

  assert.equal(profile.id, 'spk-test');
  assert.equal(profile.f0MeanHz, 150);
  assert.equal(profile.harmonics.length, 8);
  assert.equal(profile.harmonics[0].freqHz, 150);
  assert.equal(profile.harmonics[1].freqHz, 300);
  assert.equal(profile.harmonics[2].freqHz, 450);
  assert.ok(profile.formants.f1 > 0);
  assert.ok(profile.formants.f2 > profile.formants.f1);
  assert.ok(profile.formants.f3 > profile.formants.f2);
});

test('generateSpeakerFrequencyPoints creates smooth envelope across spectrum', () => {
  const profile = createSpeakerProfile('spk-test', 'Test Speaker', '#06b6d4', 130, []);
  const points = generateSpeakerFrequencyPoints(profile, 60);

  assert.equal(points.length, 60);
  assert.ok(points[0].freqHz <= 60);
  assert.ok(points[points.length - 1].freqHz >= 7000);
  // Resonance peak at fundamental F0
  const f0Point = points.find((p) => Math.abs(p.freqHz - 130) < 30);
  assert.ok(f0Point !== undefined, 'F0 point should exist');
  assert.ok(f0Point.db > -30, 'F0 resonance should have high dB amplitude');
});

test('extractVocalFingerprints returns speaker profiles from audio samples', () => {
  const samples = generateDemoAudio('phone_memo_hum', 2.0, 44100);
  const profiles = extractVocalFingerprints(samples, 44100);

  assert.ok(profiles.length >= 1, 'Should extract at least 1 speaker profile');
  const p1 = profiles[0];
  assert.ok(p1.f0MeanHz >= 80 && p1.f0MeanHz <= 350, `F0 should be in human range: ${p1.f0MeanHz}`);
  assert.ok(p1.harmonics.length === 8);
});
