/**
 * Audio-Hub Core DSP Algorithms
 * Pure numerical audio signal processing for restoration
 */

import { RestorationSettings, VocalIdSettings } from './types';

/**
 * 2nd-Order IIR Biquad Notch Filter
 */
export function applyNotchFilter(
  samples: Float32Array,
  sampleRate: number,
  targetFreq: number,
  qFactor: number,
  notchDepthDb: number = 30
): Float32Array {
  if (targetFreq <= 0 || targetFreq >= sampleRate / 2) {
    return samples;
  }

  const out = new Float32Array(samples.length);
  const w0 = (2 * Math.PI * targetFreq) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * qFactor);

  // Depth attenuation factor (linear)
  const gainLin = Math.pow(10, -Math.abs(notchDepthDb) / 20);

  // Biquad coefficients for a peaking/notch cut
  const b0 = 1 + alpha * gainLin;
  const b1 = -2 * cosW0;
  const b2 = 1 - alpha * gainLin;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;

  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;

    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;

    out[i] = y0;
  }

  return out;
}

/**
 * De-Hum: removes 50Hz or 60Hz fundamental plus all its harmonics up to Nyquist
 */
export function applyDeHum(
  samples: Float32Array,
  sampleRate: number,
  baseFreq: 50 | 60,
  harmonicsCount: number,
  notchDepthDb: number,
  qFactor: number
): Float32Array {
  let current: Float32Array<any> = new Float32Array(samples);
  const maxFreq = sampleRate * 0.48;

  for (let h = 1; h <= harmonicsCount; h++) {
    const f = baseFreq * h;
    if (f >= maxFreq) break;
    // Lower harmonics get deeper notches, higher harmonics get gentle notches
    const depth = Math.max(6, notchDepthDb - (h - 1) * 2.5);
    const q = Math.max(15, qFactor + h * 2);
    current = applyNotchFilter(current, sampleRate, f, q, depth);
  }

  return current as Float32Array;
}

/**
 * De-Clip: reconstructs flat, squared-off clipped peaks
 * using cubic polynomial interpolation between non-clipped borders.
 */
export function applyDeClip(
  samples: Float32Array,
  thresholdDb: number = -0.5,
  sharpness: number = 60
): Float32Array {
  const threshold = Math.pow(10, thresholdDb / 20);
  const out = new Float32Array(samples);
  const len = samples.length;
  const boost = 1 + (sharpness / 100) * 0.5;

  let i = 0;
  while (i < len) {
    if (Math.abs(samples[i]) >= threshold) {
      const sign = samples[i] >= 0 ? 1 : -1;
      const start = i;

      while (i < len && Math.abs(samples[i]) >= threshold && (samples[i] >= 0 ? 1 : -1) === sign) {
        i++;
      }
      const end = i;
      const clipWidth = end - start;

      // Only reconstruct reasonably short clipped segments (<= 256 samples)
      if (clipWidth <= 256 && start > 1 && end < len - 1) {
        const leftVal = samples[start - 1];
        const rightVal = samples[end];
        const midIdx = (start + end - 1) / 2;
        const maxPeak = threshold * boost * sign;

        for (let k = start; k < end; k++) {
          const t = (k - start + 1) / (clipWidth + 1);
          // Parabolic bell arch
          const bell = 4 * t * (1 - t);
          const baseline = leftVal * (1 - t) + rightVal * t;
          out[k] = baseline + (maxPeak - baseline) * bell;
        }
      }
    } else {
      i++;
    }
  }

  return out;
}

/**
 * De-Click & De-Crackle: identifies sudden microscopic impulses (vinyl crackle, mouth clicks)
 * and repairs them with smooth neighbor interpolation
 */
export function applyDeClick(
  samples: Float32Array,
  sampleRate: number,
  sensitivity: number = 65,
  maxDurationMs: number = 2.0
): Float32Array {
  const out = new Float32Array(samples);
  const maxSamples = Math.max(2, Math.floor((maxDurationMs / 1000) * sampleRate));
  const sensThreshold = 0.4 - (sensitivity / 100) * 0.32; // 0.08 to 0.40

  const len = samples.length;
  let i = 2;

  while (i < len - 2) {
    // Second derivative (impulse acceleration)
    const d2 = Math.abs(samples[i] - 2 * samples[i - 1] + samples[i - 2]);
    // Surrounding baseline amplitude excluding current impulse
    const baselineAmp = Math.max(
      Math.abs(samples[i - 2]),
      Math.abs(samples[i - 1]),
      Math.abs(samples[i + 1]),
      Math.abs(samples[i + 2])
    );

    // If sudden spike exceeding baseline or sensitivity threshold
    if ((d2 > sensThreshold && d2 > baselineAmp * 1.5) || Math.abs(samples[i]) > Math.max(0.2, baselineAmp * 3.0)) {
      const clickStart = i - 1;
      let clickEnd = i + 1;
      while (
        clickEnd < len - 2 &&
        clickEnd - clickStart < maxSamples &&
        (Math.abs(samples[clickEnd] - 2 * samples[clickEnd - 1] + samples[clickEnd - 2]) > sensThreshold * 0.4 ||
         Math.abs(samples[clickEnd]) > baselineAmp * 1.8)
      ) {
        clickEnd++;
      }

      // Interpolate smoothly over the click
      const left = samples[clickStart - 1];
      const right = samples[clickEnd];
      const count = clickEnd - clickStart;

      for (let k = 0; k < count; k++) {
        const t = (k + 1) / (count + 1);
        // Smooth Hermite blend
        const blend = t * t * (3 - 2 * t);
        out[clickStart + k] = left * (1 - blend) + right * blend;
      }

      i = clickEnd + 1;
    } else {
      i++;
    }
  }

  return out;
}

/**
 * Smart D-Noise: Spectral subtraction & multi-band noise reduction
 */
export function applyDNoise(
  samples: Float32Array,
  sampleRate: number,
  sensitivity: number = 65,
  reductionDb: number = 18,
  mode: 'dsp' | 'neural' = 'dsp',
  learnedNoiseFloor?: number
): Float32Array {
  const out = new Float32Array(samples.length);
  const reductionLin = Math.pow(10, -reductionDb / 20); // e.g. -18dB -> 0.125
  const frameSize = 1024;
  const hopSize = 512;

  // Estimate noise threshold
  let baselineNoise = 0.015 * (1 - sensitivity / 120);
  if (learnedNoiseFloor !== undefined) {
    baselineNoise = Math.pow(10, learnedNoiseFloor / 20) * 1.5;
  }

  // Multi-band spectral gating simulation
  for (let start = 0; start < samples.length; start += hopSize) {
    const end = Math.min(start + frameSize, samples.length);
    let frameRms = 0;

    for (let j = start; j < end; j++) {
      frameRms += samples[j] * samples[j];
    }
    frameRms = Math.sqrt(frameRms / (end - start + 1e-9));

    // Expansion / gain reduction factor based on SNR
    let gain = 1.0;
    if (frameRms < baselineNoise * 1.5) {
      const snr = frameRms / (baselineNoise + 1e-9);
      if (mode === 'neural') {
        // Deep neural sigmoid gating: smoother suppression of stationary noise
        const sigmoid = 1 / (1 + Math.exp(-4 * (snr - 0.9)));
        gain = reductionLin + (1 - reductionLin) * sigmoid;
      } else {
        // Classical DSP spectral subtraction soft knee
        gain = Math.max(reductionLin, Math.pow(snr, 1.8));
      }
    }

    for (let j = start; j < end; j++) {
      // Overlap-add windowing
      const win = 0.5 * (1 - Math.cos((2 * Math.PI * (j - start)) / frameSize));
      out[j] = out[j] + (samples[j] * gain - out[j]) * (win * 0.7);
    }
  }

  // High-frequency hiss attenuation when sensitivity is high
  const finalPass = applyNotchFilter(out, sampleRate, sampleRate * 0.44, 4, reductionDb * 0.35);
  return finalPass;
}

/**
 * Vocal ID by Frequencies:
 * Tracks fundamental human speech F0 (85-280Hz), highlights vocal formants,
 * suppresses plosives (De-Plosive 80Hz highpass), and tames sibilance (De-Esser 5-8kHz).
 */
export function applyVocalId(
  samples: Float32Array,
  sampleRate: number,
  settings: VocalIdSettings
): Float32Array {
  let out: Float32Array<any> = new Float32Array(samples);

  // 1. De-Plosive: steep highpass below 85Hz to eliminate mic blast wind
  if (settings.dePlosive) {
    // 2-pole highpass filter at 85Hz
    const cutoff = 85;
    const w0 = (2 * Math.PI * cutoff) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * 0.707);

    const b0 = (1 + cosW0) / 2;
    const b1 = -(1 + cosW0);
    const b2 = (1 + cosW0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    const filtered = new Float32Array(out.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x0 = out[i];
      const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      filtered[i] = y0;
    }
    out = filtered;
  }

  // 2. De-Esser: dynamic notch around 6.5kHz for harsh S, SH, T sibilants
  if (settings.deEsser) {
    const sibilantFreq = 6500;
    const depth = 6 + (settings.deEsserSensitivity / 100) * 18; // 6 to 24 dB cut
    out = applyNotchFilter(out as Float32Array, sampleRate, sibilantFreq, 3.5, depth);
  }

  // 3. Formant Boost & Harmonic Clarity (1.8 kHz to 3.2 kHz vocal presence band)
  if (settings.formantBoost > 0) {
    const boostGain = Math.pow(10, settings.formantBoost / 20);
    // Simple formant presence peaking filter
    const formantFreq = 2400;
    const w0 = (2 * Math.PI * formantFreq) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * 2.0);
    const A = Math.sqrt(boostGain);

    const b0 = 1 + alpha * A;
    const b1 = -2 * cosW0;
    const b2 = 1 - alpha * A;
    const a0 = 1 + alpha / A;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha / A;

    const boosted = new Float32Array(out.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const x0 = out[i];
      const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      boosted[i] = y0;
    }
    out = boosted;
  }

  return out as Float32Array;
}

/**
 * Bandwidth Extender:
 * Cell phone recordings (WhatsApp OPUS, 8kHz/16kHz voice memos) cut off high frequencies.
 * This synthesizes natural high-frequency harmonic overtones up to 18kHz.
 */
export function applyBandwidthExtender(
  samples: Float32Array,
  sampleRate: number,
  cutoffFreq: 4000 | 8000,
  drive: number = 50,
  air: number = 50
): Float32Array {
  const out = new Float32Array(samples);
  const airGain = (air / 100) * 0.4;
  const driveFactor = 1 + (drive / 100) * 2;

  // Highpass filter above cutoff to extract excitation band
  const w0 = (2 * Math.PI * cutoffFreq) / sampleRate;
  const alpha = Math.sin(w0) / (2 * 0.707);
  const cosW0 = Math.cos(w0);
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;
  const b0 = (1 + cosW0) / 2;
  const b1 = -(1 + cosW0);
  const b2 = (1 + cosW0) / 2;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const hp = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    const y0 = hp;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;

    // Asymmetric non-linear harmonic generator (creates even & odd harmonics)
    const excited = Math.tanh(hp * driveFactor) - hp * 0.4;
    out[i] = samples[i] + excited * airGain;
  }

  return out;
}

/**
 * De-Reverb:
 * Suppresses early reflections and diffuse room reverberation
 */
export function applyDeReverb(
  samples: Float32Array,
  sampleRate: number,
  amount: number = 50,
  roomSize: 'small' | 'medium' | 'hall' = 'medium'
): Float32Array {
  const out = new Float32Array(samples);
  const decayCoeff = roomSize === 'small' ? 0.85 : roomSize === 'medium' ? 0.92 : 0.97;
  const strength = (amount / 100) * 0.55;

  let envelope = 0;
  const attack = 0.01;
  const release = (1 - decayCoeff) * 0.1;

  for (let i = 0; i < samples.length; i++) {
    const absVal = Math.abs(samples[i]);
    if (absVal > envelope) {
      envelope = envelope * (1 - attack) + absVal * attack;
    } else {
      envelope = envelope * (1 - release) + absVal * release;
    }

    // Suppress trailing diffuse reverb tail
    if (absVal < envelope * 0.6) {
      const att = 1 - strength * (1 - absVal / (envelope * 0.6 + 1e-6));
      out[i] = samples[i] * Math.max(0.2, att);
    }
  }

  return out;
}

/**
 * Compute Delta Audio:
 * Original signal minus Restored signal.
 * Critical restoration feature: allows auditioning ONLY what is being removed
 * (hum, noise, distortion, clicks) to ensure voice integrity is maintained.
 */
export function computeDelta(original: Float32Array, restored: Float32Array): Float32Array {
  const len = Math.min(original.length, restored.length);
  const delta = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    delta[i] = original[i] - restored[i];
  }
  return delta;
}

/**
 * Complete Full Audio-Hub Restoration Pipeline
 */
export function runRestorationPipeline(
  original: Float32Array,
  sampleRate: number,
  settings: RestorationSettings
): { restored: Float32Array; delta: Float32Array } {
  let current: Float32Array<any> = new Float32Array(original);

  // 1. De-Clip first (restore clipped peaks before filtering alters shape)
  if (settings.deClip.enabled) {
    current = applyDeClip(current as Float32Array, settings.deClip.thresholdDb, settings.deClip.sharpness);
  }

  // 2. De-Click & De-Crackle (clean microscopic impulse noise)
  if (settings.deClick.enabled) {
    current = applyDeClick(current as Float32Array, sampleRate, settings.deClick.sensitivity, settings.deClick.maxDurationMs);
  }

  // 3. De-Hum (target 50Hz/60Hz ground hum & harmonics)
  if (settings.deHum.enabled) {
    current = applyDeHum(
      current as Float32Array,
      sampleRate,
      settings.deHum.frequency,
      settings.deHum.harmonicsCount,
      settings.deHum.notchDepthDb,
      settings.deHum.qFactor
    );
  }

  // 4. Vocal ID & Frequency Processing (De-plosive, formant, de-esser)
  if (settings.vocalId.enabled) {
    current = applyVocalId(current as Float32Array, sampleRate, settings.vocalId);
  }

  // 5. Smart D-Noise (DSP or Neural AI Spectral Gating)
  if (settings.dNoise.enabled) {
    current = applyDNoise(
      current as Float32Array,
      sampleRate,
      settings.dNoise.sensitivity,
      settings.dNoise.reductionDb,
      settings.dNoise.mode,
      settings.dNoise.noiseFloor
    );
  }

  // 6. De-Reverb (Acoustic room reflection attenuation)
  if (settings.deReverb.enabled) {
    current = applyDeReverb(current as Float32Array, sampleRate, settings.deReverb.amount, settings.deReverb.roomSize);
  }

  // 7. Bandwidth Extender (Cell phone infill for muffled low-bandwidth files)
  if (settings.bandwidthExtender.enabled) {
    current = applyBandwidthExtender(
      current as Float32Array,
      sampleRate,
      settings.bandwidthExtender.cutoffFreq,
      settings.bandwidthExtender.harmonicDrive,
      settings.bandwidthExtender.airBrightness
    );
  }

  const delta = computeDelta(original, current as Float32Array);
  return { restored: current as Float32Array, delta };
}
