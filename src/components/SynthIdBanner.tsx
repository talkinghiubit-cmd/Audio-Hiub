import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, Cpu, RefreshCw, Info } from 'lucide-react';
import { SynthIdInspection } from '../dsp/types';

interface SynthIdBannerProps {
  inspection: SynthIdInspection;
  fileName: string;
  duration: number;
  sampleRate: number;
  onRefreshScan: () => void;
  onRunGeminiDeepAnalysis: () => Promise<void>;
  isAnalyzing: boolean;
  geminiExplanation?: string | null;
}

export const SynthIdBanner: React.FC<SynthIdBannerProps> = ({
  inspection,
  fileName,
  duration,
  sampleRate,
  onRefreshScan,
  onRunGeminiDeepAnalysis,
  isAnalyzing,
  geminiExplanation,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const isAi = inspection.isAiGenerated;
  const conf = inspection.confidenceScore;

  return (
    <div
      className={`relative rounded-xl border p-3.5 transition-all shadow-xl backdrop-blur-md ${
        isAi
          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Status Icon and Main Verdict */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-inner ${
              isAi
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-400'
                : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
            }`}
          >
            {isAi ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold opacity-75">
                SynthID Authenticity & Voice Cloning Inspector
              </span>
              {inspection.watermarkFound && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Watermark Injected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 mt-0.5">
              <h3 className="text-base font-bold text-white tracking-tight">
                {isAi ? 'Flagged: AI Voice Clone / Deepfake Detected' : 'Verified: Authentic Human Speech'}
              </h3>
              <div
                className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                  isAi ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50' : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                }`}
              >
                {conf.toFixed(1)}% Confidence
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions & Badges */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showDetails ? 'Hide Forensics' : 'Forensics Breakdown'}</span>
          </button>

          <button
            onClick={onRunGeminiDeepAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing with AI...</span>
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5" />
                <span>Verify with Gemini AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Forensic Breakdown Drawer */}
      {showDetails && (
        <div className="mt-3.5 pt-3 border-t border-slate-700/40 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Column 1: Detected Characteristics */}
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] block mb-1.5">
              Acoustic Heuristics & Anomalies
            </span>
            <ul className="space-y-1">
              {inspection.detectedArtifacts.map((art, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>{art}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Watermark & Subbands */}
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] block mb-1.5">
              SynthID Spectral Watermark Subbands
            </span>
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Watermark Signature:</span>
                <strong className={inspection.watermarkFound ? 'text-amber-400' : 'text-slate-300'}>
                  {inspection.watermarkFound ? 'Detected (Active)' : 'None Detected'}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Carrier Subbands:</span>
                <span className="font-mono text-cyan-300">
                  {inspection.watermarkedBands.length > 0
                    ? inspection.watermarkedBands.join(', ') + ' Hz'
                    : 'Standard acoustic spectrum'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tamper Resistance:</span>
                <span className="font-mono text-emerald-400">
                  {100 - inspection.tamperScore}% Intact
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: Cryptographic Provenance Hash */}
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] block mb-1.5">
              C2PA Manifest & Provenance Hash
            </span>
            <div className="font-mono text-[11px] text-slate-400 break-all bg-slate-900/90 p-1.5 rounded border border-slate-800">
              {inspection.fingerprintHash}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Cryptographically signed manifest can be embedded on export to guarantee verification history.
            </p>
          </div>
        </div>
      )}

      {/* Gemini AI Detailed Explanation if returned */}
      {geminiExplanation && (
        <div className="mt-2.5 px-3 py-2 bg-slate-900/90 rounded-lg border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2">
          <Cpu className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-semibold mb-0.5">Gemini 3.8 Flash Forensic Insight:</strong>
            <p className="leading-relaxed">{geminiExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
};
