import React, { useRef } from 'react';
import {
  Wand2,
  FolderArchive,
  Download,
  Upload,
  Mic,
  Disc,
  Radio,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Fingerprint,
} from 'lucide-react';
import { AuditionMode } from '../dsp/types';
import { DEMO_PRESETS } from '../dsp/sampleAudio';

interface HeaderBarProps {
  auditionMode: AuditionMode;
  onAuditionModeChange: (mode: AuditionMode) => void;
  onSelectPreset: (presetId: string) => void;
  activePresetId: string;
  onFileUpload: (file: File) => void;
  onOpenBatchModal: () => void;
  onOpenExportModal: () => void;
  onAutoDoctor: () => void;
  isAutoDoctoring: boolean;
  onToggleMic: () => void;
  isRecordingMic: boolean;
  onToggleFingerprintPanel: () => void;
  isFingerprintPanelOpen: boolean;
  peakDb: number;
  rmsDb: number;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  auditionMode,
  onAuditionModeChange,
  onSelectPreset,
  activePresetId,
  onFileUpload,
  onOpenBatchModal,
  onOpenExportModal,
  onAutoDoctor,
  isAutoDoctoring,
  onToggleMic,
  isRecordingMic,
  onToggleFingerprintPanel,
  isFingerprintPanelOpen,
  peakDb,
  rmsDb,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  // Convert dB to meter height %
  const getMeterPercent = (db: number) => {
    if (db <= -60) return 0;
    if (db >= 0) return 100;
    return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  };

  const peakPercent = getMeterPercent(peakDb);
  const rmsPercent = getMeterPercent(rmsDb);
  const isClipping = peakDb >= -0.1;

  return (
    <header className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-950/95 border-b border-slate-800/90 gap-3 backdrop-blur-xl">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-400/30">
          <Radio className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-black tracking-tight text-white font-mono">
              AUDIO-HUB
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              PRO RESTORATION
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            Smart D-Noise • Vocal ID • SynthID Verification • Multi-Format Suite
          </p>
        </div>
      </div>

      {/* Center: Audition Mode Selector (Restored vs Original vs Delta) */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/90 shadow-inner">
        <span className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider">
          Audition:
        </span>
        <button
          onClick={() => onAuditionModeChange('restored')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            auditionMode === 'restored'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Restored</span>
        </button>

        <button
          onClick={() => onAuditionModeChange('original')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            auditionMode === 'original'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Original (Bypass)</span>
        </button>

        <button
          onClick={() => onAuditionModeChange('delta')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            auditionMode === 'delta'
              ? 'bg-rose-500 text-white shadow-md font-extrabold shadow-rose-950/50'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          title="Hear removed noise & distortion only"
        >
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          <span>Delta (Removed Noise)</span>
        </button>
      </div>

      {/* Preset Audio Case Selectors */}
      <div className="flex items-center gap-1.5">
        <select
          value={activePresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
          className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 max-w-[210px] truncate"
        >
          <option value="" disabled>Load Audio Case / Preset...</option>
          {DEMO_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* One-Click Auto-Doctor */}
        <button
          onClick={onAutoDoctor}
          disabled={isAutoDoctoring}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
          title="Analyze audio and auto-configure optimal restoration chain"
        >
          <Wand2 className={`w-3.5 h-3.5 ${isAutoDoctoring ? 'animate-spin' : ''}`} />
          <span>{isAutoDoctoring ? 'Analyzing...' : 'Auto-Doctor'}</span>
        </button>
      </div>

      {/* Right Controls: Upload, Mic, Batch, Export, and VU Meter */}
      <div className="flex items-center gap-2">
        {/* Upload Any Format */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*,.m4a,.caf,.opus,.ogg,.amr,.3gp,.wav,.mp3,.flac,.aif,.aiff,.mp4,.mov,.webm"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition"
          title="Supports WAV, AIFF, M4A, CAF, OPUS, OGG, MP3, AMR, 3GP, and Video MP4/MOV extraction"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Open File</span>
        </button>

        {/* Live Mic */}
        <button
          onClick={onToggleMic}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
            isRecordingMic
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-slate-200'
          }`}
        >
          <Mic className={`w-3.5 h-3.5 ${isRecordingMic ? 'text-rose-400' : 'text-slate-400'}`} />
          <span>{isRecordingMic ? 'Stop Mic' : 'Live Mic'}</span>
        </button>

        {/* Vocal ID Fingerprint Side-Panel Toggle */}
        <button
          onClick={onToggleFingerprintPanel}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
            isFingerprintPanelOpen
              ? 'bg-indigo-500/25 border-indigo-400 text-indigo-300 shadow-md shadow-indigo-950/40'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-slate-300'
          }`}
          title="Toggle Vocal ID Fingerprint side-panel with speaker F0 & harmonic profiles"
        >
          <Fingerprint className={`w-3.5 h-3.5 ${isFingerprintPanelOpen ? 'text-indigo-400' : 'text-cyan-400'}`} />
          <span>Vocal ID Fingerprint</span>
        </button>

        {/* Batch Processing */}
        <button
          onClick={onOpenBatchModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-200 shadow-sm transition"
        >
          <FolderArchive className="w-3.5 h-3.5 text-cyan-400" />
          <span>Batch</span>
        </button>

        {/* Export Master */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-950/50 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Master Peak / RMS VU Meter */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800/80">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono text-slate-400">VU</span>
            <div
              className={`w-2 h-2 rounded-full ${
                isClipping ? 'bg-rose-500 shadow-sm shadow-rose-500' : 'bg-slate-700'
              }`}
              title="Clip indicator"
            />
          </div>
          <div className="w-2.5 h-8 bg-slate-900 rounded-sm p-0.5 flex flex-col justify-end border border-slate-800">
            <div
              className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500 rounded-xs transition-all duration-75"
              style={{ height: `${peakPercent}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-400 w-9 text-right">
            {peakDb > -60 ? `${peakDb.toFixed(1)}` : '-inf'}
            <span className="text-[8px] text-slate-400 block">dB</span>
          </div>
        </div>
      </div>
    </header>
  );
};
