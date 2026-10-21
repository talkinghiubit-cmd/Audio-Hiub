import React, { useState } from 'react';
import {
  Download,
  X,
  FileCheck,
  ShieldCheck,
  Disc,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { ExportConfig } from '../dsp/types';
import { exportAudioFile, triggerFileDownload } from '../dsp/audioExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  samples: Float32Array;
  sampleRate: number;
  originalFileName: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  samples,
  sampleRate,
  originalFileName,
}) => {
  const [format, setFormat] = useState<ExportConfig['format']>('wav');
  const [bitDepth, setBitDepth] = useState<ExportConfig['bitDepth']>(24);
  const [targetSampleRate, setTargetSampleRate] = useState<ExportConfig['sampleRate']>(48000);
  const [useTpdfDither, setUseTpdfDither] = useState(true);
  const [embedSynthId, setEmbedSynthId] = useState(true);
  const [embedC2pa, setEmbedC2pa] = useState(true);

  if (!isOpen) return null;

  // Approximate uncompressed output size calculation
  const bytesPerSample = (bitDepth / 8);
  const resampleRatio = targetSampleRate / sampleRate;
  const estimatedSamples = Math.round(samples.length * resampleRatio);
  const estimatedSizeBytes = estimatedSamples * bytesPerSample + 646; // + BWF header
  const estimatedSizeMb = (estimatedSizeBytes / (1024 * 1024)).toFixed(2);

  const handleExport = () => {
    const config: ExportConfig = {
      format,
      bitDepth,
      sampleRate: targetSampleRate,
      useTpdfDither,
      embedSynthIdWatermark: embedSynthId,
      embedC2paManifest: embedC2pa,
    };

    const { blob, fullFileName } = exportAudioFile(
      samples,
      sampleRate,
      config,
      originalFileName
    );

    triggerFileDownload(blob, fullFileName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Export & Format Conversion Master
              </h2>
              <p className="text-xs text-slate-400">
                High-fidelity rendering with BWF metadata and SynthID verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          {/* Format selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Target Output Format
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'wav', label: 'WAV (BWF)', desc: 'Studio standard' },
                { id: 'aiff', label: 'AIFF', desc: 'Apple uncompressed' },
                { id: 'flac', label: 'FLAC', desc: 'Lossless packed' },
                { id: 'mp3', label: 'MP3', desc: 'Web compressed' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id as any)}
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                    format === f.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold">{f.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bit Depth & Sample Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Bit Depth
              </label>
              <select
                value={bitDepth}
                onChange={(e) => setBitDepth(parseInt(e.target.value) as any)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value={16}>16-bit PCM (CD Standard)</option>
                <option value={24}>24-bit PCM (Studio Master)</option>
                <option value={32}>32-bit Float (Infinite Headroom)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Sample Rate (SRC)
              </label>
              <select
                value={targetSampleRate}
                onChange={(e) => setTargetSampleRate(parseInt(e.target.value) as any)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value={44100}>44,100 Hz (Music / CD)</option>
                <option value={48000}>48,000 Hz (Video / Broadcast)</option>
                <option value={96000}>96,000 Hz (Hi-Res Archival)</option>
              </select>
            </div>
          </div>

          {/* Dithering & Forensics toggles */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-300">
                  Apply TPDF Noise-Shaped Dither (Prevents Quantization Distortion)
                </span>
              </div>
              <input
                type="checkbox"
                checked={useTpdfDither}
                onChange={(e) => setUseTpdfDither(e.target.checked)}
                className="accent-cyan-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 cursor-pointer">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs text-emerald-200 block font-medium">
                    Embed SynthID Restoration Watermark & C2PA Provenance
                  </span>
                  <span className="text-[10px] text-emerald-400/80">
                    Provides tamper-evident verification that audio was restored
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={embedSynthId}
                onChange={(e) => setEmbedSynthId(e.target.checked)}
                className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* File size preview */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-950 rounded-lg text-xs font-mono text-slate-400">
            <span>Estimated Master File Size:</span>
            <span className="text-cyan-400 font-bold">~{estimatedSizeMb} MB</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/50 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export Master ({format.toUpperCase()})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
