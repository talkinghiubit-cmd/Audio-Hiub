/**
 * Audio-Hub DSP & Restoration Type Definitions
 */

export interface DNoiseSettings {
  enabled: boolean;
  mode: 'dsp' | 'neural';
  sensitivity: number; // 0 - 100
  reductionDb: number; // 0 - 36 dB
  learnProfileActive: boolean;
  noiseFloor: number; // -80 to -20 dB
  learnedProfile?: Float32Array;
}

export interface VocalIdSettings {
  enabled: boolean;
  trackF0: boolean;
  fundamentalMin: number; // 80 Hz
  fundamentalMax: number; // 300 Hz
  formantBoost: number; // 0 - 12 dB
  deEsser: boolean;
  deEsserSensitivity: number; // 0 - 100
  dePlosive: boolean;
  speakerId: number; // 1, 2, 3
  isolateVocals: boolean;
}

export interface DeHumSettings {
  enabled: boolean;
  frequency: 50 | 60; // 50Hz (EU/Asia) or 60Hz (US/Americas)
  harmonicsCount: number; // 1 - 10
  notchDepthDb: number; // 6 - 48 dB
  qFactor: number; // 10 - 60
}

export interface DeClipSettings {
  enabled: boolean;
  thresholdDb: number; // -18 to 0 dB
  sharpness: number; // 0 - 100
  mode: 'cubic' | 'spline';
}

export interface DeClickSettings {
  enabled: boolean;
  sensitivity: number; // 0 - 100
  maxDurationMs: number; // 0.2 - 5.0 ms
  mode: 'vinyl' | 'mouth';
}

export interface DeReverbSettings {
  enabled: boolean;
  amount: number; // 0 - 100
  roomSize: 'small' | 'medium' | 'hall';
}

export interface BandwidthExtenderSettings {
  enabled: boolean;
  cutoffFreq: 4000 | 8000; // Hz
  harmonicDrive: number; // 0 - 100
  airBrightness: number; // 0 - 100
}

export interface RestorationSettings {
  deHum: DeHumSettings;
  dNoise: DNoiseSettings;
  vocalId: VocalIdSettings;
  deClip: DeClipSettings;
  deClick: DeClickSettings;
  deReverb: DeReverbSettings;
  bandwidthExtender: BandwidthExtenderSettings;
}

export interface SynthIdInspection {
  isScanned: boolean;
  isAiGenerated: boolean;
  confidenceScore: number; // 0 - 100%
  watermarkFound: boolean;
  watermarkStrength: number; // 0 - 100%
  tamperScore: number; // 0 - 100%
  watermarkedBands: number[]; // e.g. [1200, 2400, 4800, 9600]
  detectedArtifacts: string[];
  provenanceSummary: string;
  fingerprintHash: string;
}

export interface ExportConfig {
  format: 'wav' | 'aiff' | 'raw' | 'flac' | 'mp3';
  bitDepth: 16 | 24 | 32;
  sampleRate: 44100 | 48000 | 96000;
  useTpdfDither: boolean;
  embedSynthIdWatermark: boolean;
  embedC2paManifest: boolean;
}

export type AuditionMode = 'restored' | 'original' | 'delta';

export interface SpectralSelection {
  active: boolean;
  fMin: number;
  fMax: number;
  tStart: number;
  tEnd: number;
}
