import React, { useState } from 'react';
import {
  Users,
  Fingerprint,
  Activity,
  Mic2,
  X,
  Volume2,
  Sliders,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  Target,
} from 'lucide-react';
import {
  SpeakerProfile,
  generateSpeakerFrequencyPoints,
} from '../dsp/vocalFingerprint';

interface VocalFingerprintPanelProps {
  isOpen: boolean;
  onClose: () => void;
  speakers: SpeakerProfile[];
  activeSpeakerId: string;
  onSelectSpeaker: (speakerId: string) => void;
  onApplySpeakerToVocalId: (f0: number, formantBoost: number) => void;
  duration: number;
  currentTime: number;
}

export const VocalFingerprintPanel: React.FC<VocalFingerprintPanelProps> = ({
  isOpen,
  onClose,
  speakers,
  activeSpeakerId,
  onSelectSpeaker,
  onApplySpeakerToVocalId,
  duration,
  currentTime,
}) => {
  const [showHarmonicDetails, setShowHarmonicDetails] = useState(true);

  if (!isOpen) return null;

  const currentSpeaker = speakers.find((s) => s.id === activeSpeakerId) || speakers[0];

  // Generate SVG curve points for the active speaker (and secondary speaker if available)
  const svgWidth = 420;
  const svgHeight = 180;
  const minFreq = 50;
  const maxFreq = 8000;
  const minDb = -54;
  const maxDb = 6;

  const freqToX = (f: number) => {
    const t = Math.log10(f / minFreq) / Math.log10(maxFreq / minFreq);
    return Math.max(0, Math.min(svgWidth, t * svgWidth));
  };

  const dbToY = (db: number) => {
    const t = (db - minDb) / (maxDb - minDb);
    return Math.max(0, Math.min(svgHeight, (1 - t) * svgHeight));
  };

  const buildPath = (profile: SpeakerProfile) => {
    const points = generateSpeakerFrequencyPoints(profile, 70);
    return points
      .map((p, idx) => {
        const x = freqToX(p.freqHz);
        const y = dbToY(p.db);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <aside className="w-full lg:w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl flex flex-col h-full backdrop-blur-xl z-30 overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
            <Fingerprint className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <span>Vocal ID Fingerprint</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PROFILER
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Fundamental F0 tracking & multi-speaker harmonic signatures
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close Vocal Fingerprint Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Multi-Speaker Selection Switcher */}
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
            Identified Speaker Sources ({speakers.length})
          </span>
          <div className="grid grid-cols-2 gap-2">
            {speakers.map((spk) => {
              const isSelected = spk.id === activeSpeakerId;
              return (
                <button
                  key={spk.id}
                  onClick={() => onSelectSpeaker(spk.id)}
                  className={`p-2.5 rounded-xl border text-left transition relative overflow-hidden ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-500/80 shadow-md shadow-cyan-950/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: spk.color }}
                    />
                    <span className="font-bold text-white text-[11px] truncate">
                      {spk.name}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-300 flex justify-between">
                    <span>F0: {spk.f0MeanHz} Hz</span>
                    <span className="text-cyan-400 font-semibold">{spk.speechActivityPercent}%</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">
                    {spk.pitchRange}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Frequency-Profile Graph */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Frequency-Profile Spectrum
            </span>
            <span className="text-[10px] font-mono text-cyan-300">
              F0 Peak: {currentSpeaker.f0MeanHz} Hz
            </span>
          </div>

          {/* SVG Spectral Response Curve */}
          <div className="relative w-full h-44 bg-slate-900/60 rounded-lg border border-slate-800/80 overflow-hidden">
            <svg
              className="w-full h-full"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
            >
              {/* Horizontal dB Grid lines */}
              {[-40, -20, 0].map((db) => {
                const y = dbToY(db);
                return (
                  <g key={db}>
                    <line
                      x1={0}
                      y1={y}
                      x2={svgWidth}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="2 3"
                    />
                    <text
                      x={svgWidth - 4}
                      y={y - 3}
                      fill="rgba(255,255,255,0.3)"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {db}dB
                    </text>
                  </g>
                );
              })}

              {/* Vertical Frequency Ticks (100Hz, 500Hz, 1kHz, 2.5kHz, 5kHz) */}
              {[100, 250, 500, 1000, 2500, 5000].map((freq) => {
                const x = freqToX(freq);
                return (
                  <g key={freq}>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={svgHeight}
                      stroke="rgba(255,255,255,0.05)"
                      strokeDasharray="2 4"
                    />
                    <text
                      x={x + 2}
                      y={svgHeight - 4}
                      fill="rgba(255,255,255,0.35)"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {freq >= 1000 ? `${freq / 1000}k` : `${freq}`}
                    </text>
                  </g>
                );
              })}

              {/* Secondary Speaker Curve in background (if present) */}
              {speakers
                .filter((s) => s.id !== activeSpeakerId)
                .map((other) => (
                  <path
                    key={other.id}
                    d={buildPath(other)}
                    fill="none"
                    stroke={other.color}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity={0.45}
                  />
                ))}

              {/* Active Speaker Harmonic Stems */}
              {currentSpeaker.harmonics.slice(0, 6).map((h) => {
                const x = freqToX(h.freqHz);
                const y = dbToY(h.amplitudeDb);
                return (
                  <g key={h.harmonicNumber}>
                    <line
                      x1={x}
                      y1={svgHeight}
                      x2={x}
                      y2={y}
                      stroke={currentSpeaker.color}
                      strokeWidth="1.5"
                      opacity={0.7}
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={h.harmonicNumber === 1 ? 4 : 2.5}
                      fill={h.harmonicNumber === 1 ? '#ffffff' : currentSpeaker.color}
                      stroke={currentSpeaker.color}
                      strokeWidth={h.harmonicNumber === 1 ? 2 : 1}
                    />
                  </g>
                );
              })}

              {/* Active Speaker Primary Curve */}
              <path
                d={buildPath(currentSpeaker)}
                fill="none"
                stroke={currentSpeaker.color}
                strokeWidth="2.5"
                style={{
                  filter: `drop-shadow(0 0 4px ${currentSpeaker.color}88)`,
                }}
              />

              {/* F0 Fundamental Peak Label */}
              <text
                x={freqToX(currentSpeaker.f0MeanHz)}
                y={dbToY(currentSpeaker.harmonics[0]?.amplitudeDb || -10) - 8}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                F0 ({currentSpeaker.f0MeanHz}Hz)
              </text>
            </svg>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>50 Hz</span>
            <span>Human Voice Bandwidth</span>
            <span>8 kHz</span>
          </div>
        </div>

        {/* Action: Lock Target F0 into Vocal ID module */}
        <button
          onClick={() =>
            onApplySpeakerToVocalId(currentSpeaker.f0MeanHz, 4)
          }
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/40 transition"
        >
          <Target className="w-4 h-4" />
          <span>Lock Vocal ID to {currentSpeaker.name} ({currentSpeaker.f0MeanHz}Hz)</span>
        </button>

        {/* Diarization Timeline Activity Bar */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
              Speaker Diarization Timeline
            </span>
            <span className="text-[9px] font-mono text-slate-400">
              {duration.toFixed(1)}s Track Length
            </span>
          </div>

          {/* Timeline Bar */}
          <div className="relative w-full h-4 bg-slate-900 rounded-md overflow-hidden border border-slate-800">
            {speakers.map((spk) =>
              spk.timeSegments.map((seg, idx) => {
                const left = (seg.startSec / duration) * 100;
                const width = ((seg.endSec - seg.startSec) / duration) * 100;
                return (
                  <div
                    key={`${spk.id}-${idx}`}
                    className="absolute top-0 bottom-0 rounded-xs opacity-80"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(3, width)}%`,
                      backgroundColor: spk.color,
                    }}
                    title={`${spk.name} speaking: ${seg.startSec.toFixed(1)}s - ${seg.endSec.toFixed(1)}s`}
                  />
                );
              })
            )}

            {/* Current Playhead */}
            {duration > 0 && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-md z-10"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            )}
          </div>
        </div>

        {/* Speaker Acoustic Attributes & Formants */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
            Acoustic Biometric Fingerprint
          </span>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[9px]">Fundamental Pitch F0</span>
              <strong className="text-white font-mono text-xs">{currentSpeaker.f0MeanHz} Hz</strong>
              <span className="text-[9px] text-cyan-400 block mt-0.5">
                Range: {currentSpeaker.f0MinHz} - {currentSpeaker.f0MaxHz} Hz
              </span>
            </div>

            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[9px]">Harmonic-to-Noise (HNR)</span>
              <strong className="text-emerald-400 font-mono text-xs">+{currentSpeaker.hnrDb} dB</strong>
              <span className="text-[9px] text-slate-400 block mt-0.5">High voice clarity</span>
            </div>

            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[9px]">Vocal Formants (F1, F2, F3)</span>
              <span className="font-mono text-indigo-300 block text-[10px]">
                F1: {currentSpeaker.formants.f1}Hz
              </span>
              <span className="font-mono text-indigo-300 block text-[10px]">
                F2: {currentSpeaker.formants.f2}Hz • F3: {currentSpeaker.formants.f3}Hz
              </span>
            </div>

            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[9px]">Timbre Centroid</span>
              <strong className="text-amber-300 font-mono text-xs">
                {currentSpeaker.spectralCentroidHz} Hz
              </strong>
              <span className="text-[9px] text-slate-400 block mt-0.5">Resonant warmth</span>
            </div>
          </div>
        </div>

        {/* Harmonic Signature Table */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
              Harmonic Series (Overtones 1–8)
            </span>
            <button
              onClick={() => setShowHarmonicDetails(!showHarmonicDetails)}
              className="text-[10px] text-cyan-400 hover:underline"
            >
              {showHarmonicDetails ? 'Hide' : 'Show'}
            </button>
          </div>

          {showHarmonicDetails && (
            <div className="space-y-1 font-mono text-[10px]">
              {currentSpeaker.harmonics.map((h) => (
                <div
                  key={h.harmonicNumber}
                  className="flex items-center justify-between py-0.5 px-1.5 rounded hover:bg-slate-800/40 text-slate-300"
                >
                  <span className="text-slate-400">
                    {h.harmonicNumber === 1 ? 'F0 (Fundamental)' : `H${h.harmonicNumber} (${h.harmonicNumber}×F0)`}
                  </span>
                  <span className="text-cyan-300 font-semibold">{h.freqHz} Hz</span>
                  <span className="text-slate-400">{h.amplitudeDb} dB</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
