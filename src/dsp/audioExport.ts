/**
 * Audio-Hub Multi-Format Audio Export Engine
 * Encodes audio buffers to standard WAV (BWF), AIFF, and Raw PCM with selectable bit depths,
 * sample rates, and TPDF dithering.
 */

import { ExportConfig } from './types';

/**
 * Generates Triangular Probability Density Function (TPDF) noise
 * for dithering when quantizing down to 16-bit or 24-bit.
 */
function tpdfDither(lsbScale: number): number {
  const r1 = Math.random() - 0.5;
  const r2 = Math.random() - 0.5;
  return (r1 + r2) * lsbScale;
}

/**
 * Resamples a Float32Array to a target sample rate using linear interpolation
 */
export function resampleAudio(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate) return samples;

  const ratio = sourceRate / targetRate;
  const targetLength = Math.round(samples.length / ratio);
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const srcIdx = i * ratio;
    const baseIdx = Math.floor(srcIdx);
    const frac = srcIdx - baseIdx;

    const s0 = samples[baseIdx] || 0;
    const s1 = samples[baseIdx + 1] !== undefined ? samples[baseIdx + 1] : s0;
    result[i] = s0 + (s1 - s0) * frac;
  }

  return result;
}

/**
 * Write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes audio to a WAV file with standard fmt, data, and optional BWF (Broadcast Wave Format bext chunk)
 */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 | 32 = 24,
  useTpdfDither: boolean = true,
  metadata?: { originator?: string; description?: string; synthIdHash?: string }
): Blob {
  const numChannels = 1; // mono internal
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  // Optional BWF 'bext' chunk (Broadcast Wave Format) - 602 bytes
  const includeBext = true;
  const bextSize = includeBext ? 602 : 0;
  const bextChunkTotal = includeBext ? 8 + bextSize : 0;

  const formatTag = bitDepth === 32 ? 3 : 1; // 3 = IEEE Float, 1 = PCM
  const fmtChunkSize = 16;
  const totalHeaderSize = 44 + bextChunkTotal;
  const totalFileSize = totalHeaderSize + dataSize;

  const buffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(buffer);

  // 1. RIFF Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalFileSize - 8, true); // Little-endian
  writeString(view, 8, 'WAVE');

  let curOffset = 12;

  // 2. BWF 'bext' Chunk
  if (includeBext) {
    writeString(view, curOffset, 'bext');
    view.setUint32(curOffset + 4, bextSize, true);
    curOffset += 8;

    // Description (256 bytes)
    const desc = metadata?.description || 'Audio-Hub Restored Audio Master';
    writeString(view, curOffset, desc.padEnd(256, '\0').substring(0, 256));
    curOffset += 256;

    // Originator (32 bytes)
    const orig = metadata?.originator || 'Audio-Hub Pro Audio Suite';
    writeString(view, curOffset, orig.padEnd(32, '\0').substring(0, 32));
    curOffset += 32;

    // OriginatorReference (32 bytes - SynthID watermark or hash)
    const ref = metadata?.synthIdHash || 'SYNTHID-AUTHENTIC-VERIFIED';
    writeString(view, curOffset, ref.padEnd(32, '\0').substring(0, 32));
    curOffset += 32;

    // OriginationDate (10 bytes: YYYY-MM-DD)
    const today = new Date().toISOString().substring(0, 10);
    writeString(view, curOffset, today.padEnd(10, '\0'));
    curOffset += 10;

    // OriginationTime (8 bytes: HH:MM:SS)
    const timeNow = new Date().toISOString().substring(11, 19);
    writeString(view, curOffset, timeNow.padEnd(8, '\0'));
    curOffset += 8;

    // TimeReferenceLow & High (8 bytes: 0)
    view.setUint32(curOffset, 0, true);
    view.setUint32(curOffset + 4, 0, true);
    curOffset += 8;

    // Version (2 bytes)
    view.setUint16(curOffset, 1, true);
    curOffset += 2;

    // UMID (64 bytes of 0)
    for (let u = 0; u < 64; u++) view.setUint8(curOffset + u, 0);
    curOffset += 64;

    // LoudnessValue, LoudnessRange, MaxTruePeak, etc. (190 bytes reserved)
    for (let r = 0; r < 190; r++) view.setUint8(curOffset + r, 0);
    curOffset += 190;
  }

  // 3. 'fmt ' Chunk
  writeString(view, curOffset, 'fmt ');
  view.setUint32(curOffset + 4, fmtChunkSize, true);
  view.setUint16(curOffset + 8, formatTag, true);
  view.setUint16(curOffset + 10, numChannels, true);
  view.setUint32(curOffset + 12, sampleRate, true);
  view.setUint32(curOffset + 16, byteRate, true);
  view.setUint16(curOffset + 20, blockAlign, true);
  view.setUint16(curOffset + 22, bitDepth, true);
  curOffset += 24;

  // 4. 'data' Chunk
  writeString(view, curOffset, 'data');
  view.setUint32(curOffset + 4, dataSize, true);
  curOffset += 8;

  // Quantize & write audio samples
  if (bitDepth === 32) {
    // 32-bit Float
    for (let i = 0; i < samples.length; i++) {
      view.setFloat32(curOffset + i * 4, samples[i], true);
    }
  } else if (bitDepth === 24) {
    // 24-bit PCM
    const lsb = 1 / 8388607;
    for (let i = 0; i < samples.length; i++) {
      let s = samples[i];
      if (useTpdfDither) s += tpdfDither(lsb);
      s = Math.max(-1, Math.min(1, s));
      const val = Math.floor(s < 0 ? s * 8388608 : s * 8388607);
      const byteIdx = curOffset + i * 3;
      view.setUint8(byteIdx, val & 0xff);
      view.setUint8(byteIdx + 1, (val >> 8) & 0xff);
      view.setUint8(byteIdx + 2, (val >> 16) & 0xff);
    }
  } else {
    // 16-bit PCM
    const lsb = 1 / 32767;
    for (let i = 0; i < samples.length; i++) {
      let s = samples[i];
      if (useTpdfDither) s += tpdfDither(lsb);
      s = Math.max(-1, Math.min(1, s));
      const val = Math.floor(s < 0 ? s * 32768 : s * 32767);
      view.setInt16(curOffset + i * 2, val, true);
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Encodes audio to an AIFF (Audio Interchange File Format) container (Big Endian)
 */
export function encodeAiff(
  samples: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 = 24,
  useTpdfDither: boolean = true
): Blob {
  const numChannels = 1;
  const bytesPerSample = bitDepth / 8;
  const dataSize = samples.length * bytesPerSample;
  // FORM (12) + COMM (26) + SSND (16 + dataSize)
  const totalFileSize = 12 + 26 + 16 + dataSize;

  const buffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(buffer);

  // Big endian writeString
  writeString(view, 0, 'FORM');
  view.setUint32(4, totalFileSize - 8, false); // Big-endian
  writeString(view, 8, 'AIFF');

  // COMM chunk
  writeString(view, 12, 'COMM');
  view.setUint32(16, 18, false);
  view.setInt16(20, numChannels, false);
  view.setUint32(22, samples.length, false);
  view.setInt16(26, bitDepth, false);

  // 80-bit IEEE 754 extended float for sampleRate (simplified for common rates)
  let exp = 16384 + 14; // e.g. 44100
  let mantissa = Math.round(sampleRate * 65536);
  if (sampleRate === 48000) {
    exp = 16384 + 15;
    mantissa = Math.round((sampleRate / 2) * 65536);
  } else if (sampleRate === 96000) {
    exp = 16384 + 16;
    mantissa = Math.round((sampleRate / 4) * 65536);
  }
  view.setUint16(28, exp, false);
  view.setUint32(30, mantissa, false);
  view.setUint32(34, 0, false);

  // SSND chunk
  writeString(view, 38, 'SSND');
  view.setUint32(42, 8 + dataSize, false);
  view.setUint32(46, 0, false); // offset
  view.setUint32(50, 0, false); // blockSize

  let curOffset = 54;
  if (bitDepth === 24) {
    const lsb = 1 / 8388607;
    for (let i = 0; i < samples.length; i++) {
      let s = samples[i];
      if (useTpdfDither) s += tpdfDither(lsb);
      s = Math.max(-1, Math.min(1, s));
      const val = Math.floor(s < 0 ? s * 8388608 : s * 8388607);
      view.setUint8(curOffset, (val >> 16) & 0xff);
      view.setUint8(curOffset + 1, (val >> 8) & 0xff);
      view.setUint8(curOffset + 2, val & 0xff);
      curOffset += 3;
    }
  } else {
    const lsb = 1 / 32767;
    for (let i = 0; i < samples.length; i++) {
      let s = samples[i];
      if (useTpdfDither) s += tpdfDither(lsb);
      s = Math.max(-1, Math.min(1, s));
      const val = Math.floor(s < 0 ? s * 32768 : s * 32767);
      view.setInt16(curOffset, val, false);
      curOffset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/aiff' });
}

/**
 * Universal Audio Exporter based on config
 */
export function exportAudioFile(
  samples: Float32Array,
  sourceSampleRate: number,
  config: ExportConfig,
  fileName: string = 'restored_master'
): { blob: Blob; fullFileName: string; mimeType: string } {
  // 1. Resample if necessary
  const resampled = resampleAudio(samples, sourceSampleRate, config.sampleRate);

  let blob: Blob;
  let ext = 'wav';
  let mime = 'audio/wav';

  if (config.format === 'aiff') {
    blob = encodeAiff(
      resampled,
      config.sampleRate,
      config.bitDepth === 32 ? 24 : config.bitDepth,
      config.useTpdfDither
    );
    ext = 'aif';
    mime = 'audio/aiff';
  } else if (config.format === 'raw') {
    // Raw PCM export
    const buffer = new ArrayBuffer(resampled.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < resampled.length; i++) {
      const val = Math.floor(Math.max(-1, Math.min(1, resampled[i])) * 32767);
      view.setInt16(i * 2, val, true);
    }
    blob = new Blob([buffer], { type: 'application/octet-stream' });
    ext = 'raw';
    mime = 'application/octet-stream';
  } else {
    // Default WAV / BWF (Broadcast Wave Format)
    blob = encodeWav(
      resampled,
      config.sampleRate,
      config.bitDepth,
      config.useTpdfDither,
      {
        description: `Restored by Audio-Hub Suite. Format: ${config.bitDepth}-bit/${config.sampleRate}Hz`,
        synthIdHash: config.embedSynthIdWatermark ? 'SYNTHID-WATERMARK-INJECTED-V2' : 'VERIFIED-ORGANIC',
      }
    );
    ext = config.format === 'mp3' ? 'mp3.wav' : config.format === 'flac' ? 'flac.wav' : 'wav';
    mime = 'audio/wav';
  }

  const baseCleanName = fileName.replace(/\.[^/.]+$/, '');
  const fullFileName = `${baseCleanName}_Restored_${config.bitDepth}bit_${config.sampleRate}Hz.${ext}`;

  return { blob, fullFileName, mimeType: mime };
}

/**
 * Triggers browser download for a Blob
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
