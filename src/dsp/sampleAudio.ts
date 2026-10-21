/**
 * Audio-Hub Sample Audio Generators & Audio Decoder
 * Provides realistic pre-built audio test cases and universal file ingestion
 */

export interface DemoPreset {
  id: string;
  name: string;
  description: string;
  category: 'cellphone' | 'interview' | 'vinyl' | 'ai_deepfake';
  defaultSettings: {
    deHum?: boolean;
    dNoise?: boolean;
    vocalId?: boolean;
    deClip?: boolean;
    deClick?: boolean;
    bandwidthExtender?: boolean;
  };
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'phone_memo_hum',
    name: 'iPhone Voice Memo (60Hz Hum + HVAC Air)',
    description: 'Cell phone voice memo recorded near an air conditioner with 60Hz ground loop electrical hum and wideband fan noise.',
    category: 'cellphone',
    defaultSettings: {
      deHum: true,
      dNoise: true,
      vocalId: true,
    },
  },
  {
    id: 'clipped_podcast',
    name: 'Clipped Podcast Mic (Harsh Distortion & Plosives)',
    description: 'Mic gain pushed past 0dB causing severe squared-off clipping and loud "P" and "B" plosive breath bursts.',
    category: 'interview',
    defaultSettings: {
      deClip: true,
      vocalId: true,
    },
  },
  {
    id: 'muffled_whatsapp',
    name: 'WhatsApp Voice Note (4kHz Cutoff Low-Fi)',
    description: 'Narrow-band speech note compressed at 8kHz sample rate, sounding muffled, telephone-like, and dull.',
    category: 'cellphone',
    defaultSettings: {
      bandwidthExtender: true,
      vocalId: true,
      dNoise: true,
    },
  },
  {
    id: 'vinyl_clicks',
    name: 'Vintage Vinyl Master (Dust Crackle & Hum)',
    description: 'Warm acoustic audio plagued by dust particle clicks, surface vinyl crackle, and 50Hz turntable ground hum.',
    category: 'vinyl',
    defaultSettings: {
      deClick: true,
      deHum: true,
    },
  },
  {
    id: 'synthid_deepfake',
    name: 'AI Voice Clone (Deepfake with SynthID Watermark)',
    description: 'Synthesized cloned speech exhibiting unnatural prosody, hyper-uniform pitch contour, and embedded watermark signatures.',
    category: 'ai_deepfake',
    defaultSettings: {
      dNoise: true,
      vocalId: true,
    },
  },
];

/**
 * Procedurally generates authentic audio buffers with specific defects
 */
export function generateDemoAudio(presetId: string, durationSec: number = 4.0, sampleRate: number = 44100): Float32Array {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const buffer = new Float32Array(totalSamples);

  // Generate base speech-like vowel formants (e.g. /a/ and /o/ syllables)
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // Syllabic cadence (speech rhythm ~ 3 Hz)
    const cadence = Math.max(0, Math.sin(2 * Math.PI * 3.2 * t) * Math.sin(2 * Math.PI * 0.8 * t));

    // Pitch F0 modulation (speech inflection ~ 130Hz to 165Hz)
    const f0 = 145 + 18 * Math.sin(2 * Math.PI * 1.5 * t);
    const formant1 = 700; // F1 vowel formant
    const formant2 = 1250; // F2 formant
    const formant3 = 2600; // F3 presence

    // Voice vocal tract simulation
    const glottal = Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(4 * Math.PI * f0 * t) + 0.25 * Math.sin(6 * Math.PI * f0 * t);
    const vocal = (glottal * 0.4 +
      Math.sin(2 * Math.PI * formant1 * t) * 0.25 +
      Math.sin(2 * Math.PI * formant2 * t) * 0.18 +
      Math.sin(2 * Math.PI * formant3 * t) * 0.1) * cadence;

    buffer[i] = vocal * 0.5;
  }

  // Inject specific defects based on preset
  switch (presetId) {
    case 'phone_memo_hum': {
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        // 60Hz ground hum + 120Hz + 180Hz harmonics
        const hum = 0.16 * Math.sin(2 * Math.PI * 60 * t) +
                    0.09 * Math.sin(2 * Math.PI * 120 * t) +
                    0.05 * Math.sin(2 * Math.PI * 180 * t);
        // HVAC pink/white noise
        const noise = (Math.random() * 2 - 1) * 0.08;
        buffer[i] = buffer[i] + hum + noise;
      }
      break;
    }

    case 'clipped_podcast': {
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        // Plosive 'P' pop at t = 1.0 and 2.5
        let plosive = 0;
        if (Math.abs(t - 1.1) < 0.12) {
          plosive = Math.sin(2 * Math.PI * 45 * t) * 0.45 * Math.exp(-Math.pow((t - 1.1) * 20, 2));
        }
        if (Math.abs(t - 2.6) < 0.12) {
          plosive = Math.sin(2 * Math.PI * 52 * t) * 0.5 * Math.exp(-Math.pow((t - 2.6) * 20, 2));
        }
        // Boost signal to trigger harsh clipping
        let raw = (buffer[i] + plosive) * 2.8;
        // Hard clip flat at +/- 0.72
        if (raw > 0.72) raw = 0.72;
        if (raw < -0.72) raw = -0.72;
        buffer[i] = raw;
      }
      break;
    }

    case 'muffled_whatsapp': {
      // Simulate low-pass brickwall filter cutting off all frequencies above 3.5kHz
      let low = 0;
      const alpha = 0.18; // Lowpass coefficient
      for (let i = 0; i < totalSamples; i++) {
        low = low + alpha * (buffer[i] - low);
        // Add low-bitrate compression hiss
        buffer[i] = low + (Math.random() - 0.5) * 0.02;
      }
      break;
    }

    case 'vinyl_clicks': {
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        // 50Hz European vinyl motor hum
        const hum = 0.08 * Math.sin(2 * Math.PI * 50 * t);
        buffer[i] += hum;

        // Periodic vinyl crackle clicks
        if (Math.random() < 0.0007) {
          // Sharp impulse spike
          const spikeAmp = (Math.random() > 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.4);
          buffer[i] += spikeAmp;
          if (i + 1 < totalSamples) buffer[i + 1] += spikeAmp * 0.4;
          if (i + 2 < totalSamples) buffer[i + 2] -= spikeAmp * 0.2;
        }
      }
      break;
    }

    case 'synthid_deepfake': {
      // Simulate synthetic TTS: ultra-steady pitch (no human jitter) + high-frequency watermark modulation
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        // Watermark carriers at 1200Hz, 2400Hz, 4800Hz
        const wm = (Math.sin(2 * Math.PI * 1200 * t) + Math.sin(2 * Math.PI * 2400 * t) + Math.sin(2 * Math.PI * 4800 * t)) * 0.035;
        // Robotic vocoder phase artifact
        buffer[i] = buffer[i] * 0.8 + wm;
      }
      break;
    }
  }

  // Normalize max peak safely under 0.95
  let max = 0;
  for (let i = 0; i < totalSamples; i++) {
    if (Math.abs(buffer[i]) > max) max = Math.abs(buffer[i]);
  }
  if (max > 0.95) {
    const scale = 0.95 / max;
    for (let i = 0; i < totalSamples; i++) buffer[i] *= scale;
  }

  return buffer;
}

/**
 * Universal Audio Decoder:
 * Decodes any dropped file (WAV, MP3, M4A, CAF, OPUS, OGG, AMR, 3GP, MP4, MOV, WEBM)
 * using the browser's Web Audio AudioContext decodeAudioData
 */
export async function decodeAudioFromFile(
  file: File,
  audioContext: AudioContext
): Promise<{ buffer: AudioBuffer; channelData: Float32Array; fileName: string; sizeBytes: number; format: string }> {
  const arrayBuffer = await file.arrayBuffer();
  // decodeAudioData handles video containers (.mp4, .mov, .webm) and all native audio formats (.m4a, .opus, .ogg, .wav, .mp3)
  const decoded = await audioContext.decodeAudioData(arrayBuffer);

  // Extract mono Float32Array (or downmix if stereo/polyphonic)
  const numChannels = decoded.numberOfChannels;
  const length = decoded.length;
  const mono = new Float32Array(length);

  if (numChannels === 1) {
    mono.set(decoded.getChannelData(0));
  } else {
    // Average channels
    for (let ch = 0; ch < numChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += data[i] / numChannels;
      }
    }
  }

  const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';

  return {
    buffer: decoded,
    channelData: mono,
    fileName: file.name,
    sizeBytes: file.size,
    format: ext,
  };
}
