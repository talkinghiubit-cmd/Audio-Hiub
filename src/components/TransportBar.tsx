import React from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  Clock,
  Activity,
  Layers,
} from 'lucide-react';

interface TransportBarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  currentTime: number;
  duration: number;
  volume: number;
  onVolumeChange: (vol: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  fileName: string;
  format: string;
  sampleRate: number;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  isLooping,
  onToggleLoop,
  currentTime,
  duration,
  volume,
  onVolumeChange,
  isMuted,
  onToggleMute,
  fileName,
  format,
  sampleRate,
}) => {
  // Format seconds to HH:MM:SS.mmm
  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const millis = Math.floor((sec % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const samplePosition = Math.floor(currentTime * sampleRate);

  return (
    <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-950 border-t border-slate-800 gap-3 text-xs">
      {/* Left: Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlayPause}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition shadow-lg ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/40'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950/40'
          }`}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <button
          onClick={onStop}
          className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition"
          title="Stop & Return to Zero"
          aria-label="Stop playback"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        <button
          onClick={onToggleLoop}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
            isLooping
              ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-400 shadow-sm'
              : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Continuous Loop"
          aria-label="Toggle Loop"
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Precision Timecode & Sample Position */}
      <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-1.5 rounded-xl border border-slate-800 font-mono shadow-inner">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white font-bold text-sm tracking-widest">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-slate-400 text-[11px]">/ {formatTimecode(duration)}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 border-l border-slate-800 pl-3">
          <span>SMPL:</span>
          <span className="text-cyan-300 font-semibold">{samplePosition.toLocaleString()}</span>
        </div>
      </div>

      {/* Right: Master Output Volume & File Details */}
      <div className="flex items-center gap-4">
        {/* Active Track Info Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-400">
          <span className="text-slate-300 font-medium truncate max-w-[150px]">{fileName}</span>
          <span className="text-cyan-400 font-mono font-bold">{format}</span>
          <span>•</span>
          <span className="font-mono">{sampleRate}Hz 32-bit</span>
        </div>

        {/* Volume Fader */}
        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <button
            onClick={onToggleMute}
            className="text-slate-400 hover:text-white transition"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-300" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            aria-label="Master volume"
          />
          <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
            {isMuted ? 'MUTE' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
};
