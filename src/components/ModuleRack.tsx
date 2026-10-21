import React, { useState } from 'react';
import {
  Volume2,
  Mic,
  Activity,
  Zap,
  Disc,
  Home,
  Radio,
  Power,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
  Fingerprint,
} from 'lucide-react';
import { Knob } from './Knob';
import { RestorationSettings } from '../dsp/types';

interface ModuleRackProps {
  settings: RestorationSettings;
  onSettingsChange: (settings: RestorationSettings) => void;
  onLearnNoiseProfile: () => void;
  isLearningNoise: boolean;
  onOpenFingerprintPanel?: () => void;
}

export const ModuleRack: React.FC<ModuleRackProps> = ({
  settings,
  onSettingsChange,
  onLearnNoiseProfile,
  isLearningNoise,
  onOpenFingerprintPanel,
}) => {
  // Collapsed states per module for space efficiency
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    deHum: false,
    dNoise: false,
    vocalId: false,
    deClip: false,
    deClick: true,
    deReverb: true,
    bandwidthExtender: true,
  });

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSetting = <K extends keyof RestorationSettings>(
    module: K,
    patch: Partial<RestorationSettings[K]>
  ) => {
    onSettingsChange({
      ...settings,
      [module]: {
        ...settings[module],
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-3">
      {/* Rack Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Restoration Module Rack
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          CHAIN: DE-CLIP → DE-CLICK → DE-HUM → VOCAL ID → D-NOISE → DE-REVERB → EXTENDER
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* 1. Smart D-Noise */}
        <div
          className={`rounded-xl border transition-all ${
            settings.dNoise.enabled
              ? 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/20'
              : 'bg-slate-950/60 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting('dNoise', { enabled: !settings.dNoise.enabled })}
                className={`p-1 rounded-md border transition ${
                  settings.dNoise.enabled
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bypass Smart D-Noise"
                aria-label="Toggle D-Noise"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                1. Smart D-Noise
              </span>
            </div>
            <button
              onClick={() => toggleCollapse('dNoise')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {collapsed.dNoise ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed.dNoise && (
            <div className="p-3.5 space-y-3">
              {/* Engine Mode selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Engine Mode:</span>
                <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
                  <button
                    onClick={() => updateSetting('dNoise', { mode: 'dsp' })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      settings.dNoise.mode === 'dsp'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    DSP (Zero Latency)
                  </button>
                  <button
                    onClick={() => updateSetting('dNoise', { mode: 'neural' })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      settings.dNoise.mode === 'neural'
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Neural AI Deep Clean
                  </button>
                </div>
              </div>

              {/* Rotary Knobs */}
              <div className="flex items-center justify-around pt-1">
                <Knob
                  label="Sensitivity"
                  value={settings.dNoise.sensitivity}
                  min={0}
                  max={100}
                  unit="%"
                  color="cyan"
                  disabled={!settings.dNoise.enabled}
                  onChange={(val) => updateSetting('dNoise', { sensitivity: val })}
                />
                <Knob
                  label="Reduction"
                  value={settings.dNoise.reductionDb}
                  min={0}
                  max={36}
                  unit="dB"
                  color="cyan"
                  disabled={!settings.dNoise.enabled}
                  onChange={(val) => updateSetting('dNoise', { reductionDb: val })}
                />
              </div>

              {/* Learn Profile Button */}
              <div className="pt-1">
                <button
                  onClick={onLearnNoiseProfile}
                  disabled={!settings.dNoise.enabled || isLearningNoise}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                    isLearningNoise
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-200 border-slate-700/80 hover:border-cyan-500/40'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isLearningNoise ? 'Sampling 0.5s Silence Profile...' : 'Learn Noise Profile'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Vocal ID by Frequencies */}
        <div
          className={`rounded-xl border transition-all ${
            settings.vocalId.enabled
              ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
              : 'bg-slate-950/60 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting('vocalId', { enabled: !settings.vocalId.enabled })}
                className={`p-1 rounded-md border transition ${
                  settings.vocalId.enabled
                    ? 'bg-indigo-500 text-white border-indigo-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bypass Vocal ID"
                aria-label="Toggle Vocal ID"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                2. Vocal ID by Frequencies
              </span>
            </div>
            <button
              onClick={() => toggleCollapse('vocalId')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {collapsed.vocalId ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed.vocalId && (
            <div className="p-3.5 space-y-3">
              {/* Toggles: De-Esser & De-Plosive */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => updateSetting('vocalId', { dePlosive: !settings.vocalId.dePlosive })}
                  className={`p-1.5 rounded border text-[11px] font-medium transition ${
                    settings.vocalId.dePlosive
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  De-Plosive (85Hz)
                </button>
                <button
                  onClick={() => updateSetting('vocalId', { deEsser: !settings.vocalId.deEsser })}
                  className={`p-1.5 rounded border text-[11px] font-medium transition ${
                    settings.vocalId.deEsser
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  De-Esser (6.5kHz)
                </button>
              </div>

              {/* Rotary Knobs */}
              <div className="flex items-center justify-around pt-1">
                <Knob
                  label="Formant Boost"
                  value={settings.vocalId.formantBoost}
                  min={0}
                  max={12}
                  unit="dB"
                  color="indigo"
                  disabled={!settings.vocalId.enabled}
                  onChange={(val) => updateSetting('vocalId', { formantBoost: val })}
                />
                <Knob
                  label="De-Ess Sensitivity"
                  value={settings.vocalId.deEsserSensitivity}
                  min={0}
                  max={100}
                  unit="%"
                  color="indigo"
                  disabled={!settings.vocalId.enabled || !settings.vocalId.deEsser}
                  onChange={(val) => updateSetting('vocalId', { deEsserSensitivity: val })}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/80 px-2.5 py-1.5 rounded border border-slate-800">
                <span>F0 Pitch Tracking:</span>
                <span className="font-mono text-indigo-300 font-medium">Locked (85-280Hz)</span>
              </div>

              {onOpenFingerprintPanel && (
                <button
                  onClick={onOpenFingerprintPanel}
                  className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 flex items-center justify-center gap-1.5 transition"
                >
                  <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
                  <span>View Speaker Fingerprint & F0 Profiler</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. De-Hum & Harmonic Filter */}
        <div
          className={`rounded-xl border transition-all ${
            settings.deHum.enabled
              ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-950/20'
              : 'bg-slate-950/60 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting('deHum', { enabled: !settings.deHum.enabled })}
                className={`p-1 rounded-md border transition ${
                  settings.deHum.enabled
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bypass De-Hum"
                aria-label="Toggle De-Hum"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                3. De-Hum (Harmonic)
              </span>
            </div>
            <button
              onClick={() => toggleCollapse('deHum')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {collapsed.deHum ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed.deHum && (
            <div className="p-3.5 space-y-3">
              {/* Frequency Selector: 50Hz vs 60Hz */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Base Grid Frequency:</span>
                <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
                  <button
                    onClick={() => updateSetting('deHum', { frequency: 50 })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      settings.deHum.frequency === 50
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    50 Hz (EU/Asia)
                  </button>
                  <button
                    onClick={() => updateSetting('deHum', { frequency: 60 })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      settings.deHum.frequency === 60
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    60 Hz (US/Americas)
                  </button>
                </div>
              </div>

              {/* Rotary Knobs */}
              <div className="flex items-center justify-around pt-1">
                <Knob
                  label="Harmonics"
                  value={settings.deHum.harmonicsCount}
                  min={1}
                  max={8}
                  unit="x"
                  color="amber"
                  disabled={!settings.deHum.enabled}
                  onChange={(val) => updateSetting('deHum', { harmonicsCount: val })}
                />
                <Knob
                  label="Notch Depth"
                  value={settings.deHum.notchDepthDb}
                  min={6}
                  max={48}
                  unit="dB"
                  color="amber"
                  disabled={!settings.deHum.enabled}
                  onChange={(val) => updateSetting('deHum', { notchDepthDb: val })}
                />
              </div>

              <div className="text-[10px] text-slate-400 text-center font-mono">
                Cuts {settings.deHum.frequency}Hz + up to {settings.deHum.frequency * settings.deHum.harmonicsCount}Hz harmonics
              </div>
            </div>
          )}
        </div>

        {/* 4. De-Clip */}
        <div
          className={`rounded-xl border transition-all ${
            settings.deClip.enabled
              ? 'bg-slate-900/90 border-rose-500/40 shadow-lg shadow-rose-950/20'
              : 'bg-slate-950/60 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting('deClip', { enabled: !settings.deClip.enabled })}
                className={`p-1 rounded-md border transition ${
                  settings.deClip.enabled
                    ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bypass De-Clip"
                aria-label="Toggle De-Clip"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                4. De-Clip (Peak Repair)
              </span>
            </div>
            <button
              onClick={() => toggleCollapse('deClip')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {collapsed.deClip ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed.deClip && (
            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-around pt-1">
                <Knob
                  label="Threshold"
                  value={settings.deClip.thresholdDb}
                  min={-18}
                  max={0}
                  step={0.5}
                  unit="dB"
                  color="rose"
                  disabled={!settings.deClip.enabled}
                  onChange={(val) => updateSetting('deClip', { thresholdDb: val })}
                />
                <Knob
                  label="Sharpness"
                  value={settings.deClip.sharpness}
                  min={0}
                  max={100}
                  unit="%"
                  color="rose"
                  disabled={!settings.deClip.enabled}
                  onChange={(val) => updateSetting('deClip', { sharpness: val })}
                />
              </div>

              <div className="text-[10px] text-slate-400 text-center font-mono">
                Cubic spline arch prediction on squared flat plateaus
              </div>
            </div>
          )}
        </div>

        {/* 5. De-Click & De-Crackle */}
        <div
          className={`rounded-xl border transition-all ${
            settings.deClick.enabled
              ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
              : 'bg-slate-950/60 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting('deClick', { enabled: !settings.deClick.enabled })}
                className={`p-1 rounded-md border transition ${
                  settings.deClick.enabled
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bypass De-Click"
                aria-label="Toggle De-Click"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                5. De-Click & Crackle
              </span>
            </div>
            <button
              onClick={() => toggleCollapse('deClick')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {collapsed.deClick ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed.deClick && (
            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-around pt-1">
                <Knob
                  label="Sensitivity"
                  value={settings.deClick.sensitivity}
                  min={0}
                  max={100}
                  unit="%"
                  color="emerald"
                  disabled={!settings.deClick.enabled}
                  onChange={(val) => updateSetting('deClick', { sensitivity: val })}
                />
                <Knob
                  label="Max Width"
                  value={settings.deClick.maxDurationMs}
                  min={0.5}
                  max={4.0}
                  step={0.1}
                  unit="ms"
                  color="emerald"
                  disabled={!settings.deClick.enabled}
                  onChange={(val) => updateSetting('deClick', { maxDurationMs: val })}
                />
              </div>

              <div className="text-[10px] text-slate-400 text-center font-mono">
                Detects vinyl dust clicks and mouth saliva transients
              </div>
            </div>
          )}
        </div>

        {/* 6. De-Reverb */}
        <div
          className={`rounded-xl border transition-all ${
            settings.deReverb.enabled
              ? 'bg-slate-900/90 border-blue-500/40 shadow-lg shadow-blue-950/20'
              : 'bg-slate-950/60 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting('deReverb', { enabled: !settings.deReverb.enabled })}
                className={`p-1 rounded-md border transition ${
                  settings.deReverb.enabled
                    ? 'bg-blue-500 text-white border-blue-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bypass De-Reverb"
                aria-label="Toggle De-Reverb"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                6. De-Reverb (Room)
              </span>
            </div>
            <button
              onClick={() => toggleCollapse('deReverb')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {collapsed.deReverb ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed.deReverb && (
            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Room Model:</span>
                <select
                  value={settings.deReverb.roomSize}
                  onChange={(e) => updateSetting('deReverb', { roomSize: e.target.value as any })}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-slate-200 font-mono text-[11px]"
                >
                  <option value="small">Small Box Room</option>
                  <option value="medium">Conference / Studio</option>
                  <option value="hall">Large Echo Hall</option>
                </select>
              </div>

              <div className="flex items-center justify-around pt-1">
                <Knob
                  label="Absorption"
                  value={settings.deReverb.amount}
                  min={0}
                  max={100}
                  unit="%"
                  color="indigo"
                  disabled={!settings.deReverb.enabled}
                  onChange={(val) => updateSetting('deReverb', { amount: val })}
                />
              </div>
            </div>
          )}
        </div>

        {/* 7. Bandwidth Extender (Cell Phone Infill) */}
        <div
          className={`rounded-xl border transition-all ${
            settings.bandwidthExtender.enabled
              ? 'bg-slate-900/90 border-teal-500/40 shadow-lg shadow-teal-950/20'
              : 'bg-slate-950/60 border-slate-800/80 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateSetting('bandwidthExtender', { enabled: !settings.bandwidthExtender.enabled })
                }
                className={`p-1 rounded-md border transition ${
                  settings.bandwidthExtender.enabled
                    ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Bypass Bandwidth Extender"
                aria-label="Toggle Bandwidth Extender"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                7. Bandwidth Extender
              </span>
            </div>
            <button
              onClick={() => toggleCollapse('bandwidthExtender')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              {collapsed.bandwidthExtender ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed.bandwidthExtender && (
            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Cutoff Floor:</span>
                <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
                  <button
                    onClick={() => updateSetting('bandwidthExtender', { cutoffFreq: 4000 })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      settings.bandwidthExtender.cutoffFreq === 4000
                        ? 'bg-teal-500/20 text-teal-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    4 kHz (Telephone)
                  </button>
                  <button
                    onClick={() => updateSetting('bandwidthExtender', { cutoffFreq: 8000 })}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      settings.bandwidthExtender.cutoffFreq === 8000
                        ? 'bg-teal-500/20 text-teal-300 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    8 kHz (M4A/Opus)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-around pt-1">
                <Knob
                  label="Drive"
                  value={settings.bandwidthExtender.harmonicDrive}
                  min={0}
                  max={100}
                  unit="%"
                  color="cyan"
                  disabled={!settings.bandwidthExtender.enabled}
                  onChange={(val) => updateSetting('bandwidthExtender', { harmonicDrive: val })}
                />
                <Knob
                  label="Air Sparkle"
                  value={settings.bandwidthExtender.airBrightness}
                  min={0}
                  max={100}
                  unit="%"
                  color="cyan"
                  disabled={!settings.bandwidthExtender.enabled}
                  onChange={(val) => updateSetting('bandwidthExtender', { airBrightness: val })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
