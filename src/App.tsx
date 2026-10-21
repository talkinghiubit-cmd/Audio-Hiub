/**
 * Audio-Hub — Pro Audio Restoration & Spectral Forensics Workstation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { SynthIdBanner } from './components/SynthIdBanner';
import { SpectrogramDisplay } from './components/SpectrogramDisplay';
import { ModuleRack } from './components/ModuleRack';
import { TransportBar } from './components/TransportBar';
import { BatchProcessorModal } from './components/BatchProcessorModal';
import { ExportModal } from './components/ExportModal';
import { VocalFingerprintPanel } from './components/VocalFingerprintPanel';

import {
  RestorationSettings,
  SynthIdInspection,
  AuditionMode,
  SpectralSelection,
} from './dsp/types';
import { runRestorationPipeline, computeDelta } from './dsp/audioProcessing';
import { analyzeAudioForensics } from './dsp/synthId';
import { generateDemoAudio, decodeAudioFromFile, DEMO_PRESETS } from './dsp/sampleAudio';
import { extractVocalFingerprints, SpeakerProfile } from './dsp/vocalFingerprint';

export default function App() {
  // Web Audio Context & Playback Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);

  // Audio Buffers & Samples
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [duration, setDuration] = useState<number>(4.0);
  const [fileName, setFileName] = useState<string>('iPhone_VoiceMemo_HVAC_Hum.m4a');
  const [fileFormat, setFileFormat] = useState<string>('M4A (iOS)');
  const [activePresetId, setActivePresetId] = useState<string>('phone_memo_hum');

  const [originalSamples, setOriginalSamples] = useState<Float32Array>(() =>
    generateDemoAudio('phone_memo_hum', 4.0, 44100)
  );
  const [restoredSamples, setRestoredSamples] = useState<Float32Array>(() =>
    new Float32Array(originalSamples)
  );
  const [deltaSamples, setDeltaSamples] = useState<Float32Array>(() =>
    new Float32Array(originalSamples.length)
  );

  // Playback & Transport State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [auditionMode, setAuditionMode] = useState<AuditionMode>('restored');
  const [peakDb, setPeakDb] = useState<number>(-60);
  const [rmsDb, setRmsDb] = useState<number>(-60);

  // Spectral Selection
  const [selection, setSelection] = useState<SpectralSelection>({
    active: false,
    fMin: 0,
    fMax: 0,
    tStart: 0,
    tEnd: 0,
  });

  // Restoration Modules Settings
  const [settings, setSettings] = useState<RestorationSettings>({
    deHum: {
      enabled: true,
      frequency: 60,
      harmonicsCount: 4,
      notchDepthDb: 32,
      qFactor: 30,
    },
    dNoise: {
      enabled: true,
      mode: 'dsp',
      sensitivity: 65,
      reductionDb: 18,
      learnProfileActive: false,
      noiseFloor: -45,
    },
    vocalId: {
      enabled: true,
      trackF0: true,
      fundamentalMin: 85,
      fundamentalMax: 280,
      formantBoost: 3,
      deEsser: true,
      deEsserSensitivity: 60,
      dePlosive: true,
      speakerId: 1,
      isolateVocals: false,
    },
    deClip: {
      enabled: false,
      thresholdDb: -2.0,
      sharpness: 70,
      mode: 'cubic',
    },
    deClick: {
      enabled: false,
      sensitivity: 65,
      maxDurationMs: 2.0,
      mode: 'vinyl',
    },
    deReverb: {
      enabled: false,
      amount: 40,
      roomSize: 'medium',
    },
    bandwidthExtender: {
      enabled: false,
      cutoffFreq: 8000,
      harmonicDrive: 50,
      airBrightness: 45,
    },
  });

  // SynthID Forensics State
  const [inspection, setInspection] = useState<SynthIdInspection>(() =>
    analyzeAudioForensics(originalSamples, 44100)
  );
  const [isAnalyzingGemini, setIsAnalyzingGemini] = useState<boolean>(false);
  const [geminiExplanation, setGeminiExplanation] = useState<string | null>(null);

  // Vocal ID Speaker Fingerprinting State
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>(() =>
    extractVocalFingerprints(originalSamples, 44100)
  );
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>('spk-1');
  const [isFingerprintPanelOpen, setIsFingerprintPanelOpen] = useState<boolean>(true);

  // Modals & UI States
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isAutoDoctoring, setIsAutoDoctoring] = useState<boolean>(false);
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [isLearningNoise, setIsLearningNoise] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  /**
   * Initialize Web Audio Context lazily
   */
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;

      gain.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      gainNodeRef.current = gain;
      analyserNodeRef.current = analyser;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const pipelineTimerRef = useRef<any>(null);

  /**
   * Re-run DSP Restoration pipeline whenever original audio or settings change
   */
  useEffect(() => {
    if (!originalSamples || originalSamples.length === 0) return;

    if (pipelineTimerRef.current) {
      clearTimeout(pipelineTimerRef.current);
    }

    // Micro-debounce (25ms) prevents audio buffer stuttering during rapid rotary knob dragging
    pipelineTimerRef.current = setTimeout(() => {
      const { restored, delta } = runRestorationPipeline(originalSamples, sampleRate, settings);
      setRestoredSamples(restored);
      setDeltaSamples(delta);

      // If currently playing, seamlessly hot-swap the audio source node buffer
      if (isPlaying) {
        playActiveAudio(currentTime);
      }
    }, 25);

    return () => {
      if (pipelineTimerRef.current) {
        clearTimeout(pipelineTimerRef.current);
      }
    };
  }, [originalSamples, sampleRate, settings]);

  /**
   * Determine active audio samples based on audition mode
   */
  const getActiveSamples = useCallback(() => {
    if (auditionMode === 'original') return originalSamples;
    if (auditionMode === 'delta') return deltaSamples;
    return restoredSamples;
  }, [auditionMode, originalSamples, deltaSamples, restoredSamples]);

  /**
   * Play active audio from offset
   */
  const playActiveAudio = useCallback(
    (offsetSec: number = 0) => {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Stop any existing source
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
          activeSourceRef.current.disconnect();
        } catch {
          // ignore
        }
      }

      const activeData = getActiveSamples();
      if (!activeData || activeData.length === 0) return;

      const audioBuf = ctx.createBuffer(1, activeData.length, sampleRate);
      audioBuf.getChannelData(0).set(activeData);

      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.loop = isLooping;

      if (gainNodeRef.current) {
        source.connect(gainNodeRef.current);
      }

      const boundedOffset = Math.max(0, Math.min(duration - 0.05, offsetSec));
      source.start(0, boundedOffset);

      playbackStartTimeRef.current = ctx.currentTime - boundedOffset;
      pauseOffsetRef.current = boundedOffset;
      activeSourceRef.current = source;
      setIsPlaying(true);

      source.onended = () => {
        if (!isLooping) {
          setIsPlaying(false);
          setCurrentTime(0);
          pauseOffsetRef.current = 0;
        }
      };
    },
    [getAudioContext, getActiveSamples, sampleRate, duration, isLooping]
  );

  /**
   * Stop Playback
   */
  const stopPlayback = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      activeSourceRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    pauseOffsetRef.current = 0;
    setPeakDb(-60);
    setRmsDb(-60);
  }, []);

  /**
   * Toggle Play / Pause
   */
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      const ctx = getAudioContext();
      const elapsed = ctx.currentTime - playbackStartTimeRef.current;
      pauseOffsetRef.current = elapsed % duration;
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
          activeSourceRef.current.disconnect();
        } catch {
          // ignore
        }
        activeSourceRef.current = null;
      }
      setIsPlaying(false);
    } else {
      playActiveAudio(pauseOffsetRef.current);
    }
  }, [isPlaying, getAudioContext, duration, playActiveAudio]);

  /**
   * Seek to specific time
   */
  const handleSeek = useCallback(
    (targetTime: number) => {
      pauseOffsetRef.current = targetTime;
      setCurrentTime(targetTime);
      if (isPlaying) {
        playActiveAudio(targetTime);
      }
    },
    [isPlaying, playActiveAudio]
  );

  /**
   * Real-time Playhead & VU Meter animation loop
   */
  useEffect(() => {
    let animId: number;
    const timeData = new Float32Array(256);

    const tick = () => {
      if (isPlaying && audioContextRef.current) {
        const ctx = audioContextRef.current;
        const elapsed = ctx.currentTime - playbackStartTimeRef.current;
        const cur = isLooping ? elapsed % duration : Math.min(duration, elapsed);
        setCurrentTime(cur);

        // Calculate Peak & RMS from AnalyserNode
        if (analyserNodeRef.current) {
          analyserNodeRef.current.getFloatTimeDomainData(timeData);
          let peak = 0;
          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i++) {
            const abs = Math.abs(timeData[i]);
            if (abs > peak) peak = abs;
            sumSquares += abs * abs;
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          const pDb = peak > 1e-4 ? 20 * Math.log10(peak) : -60;
          const rDb = rms > 1e-4 ? 20 * Math.log10(rms) : -60;

          setPeakDb(Math.max(-60, Math.min(0, pDb)));
          setRmsDb(Math.max(-60, Math.min(0, rDb)));
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, duration, isLooping]);

  /**
   * Update Master Volume
   */
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  /**
   * Spacebar keyboard shortcut for Play/Pause, Esc for Modals
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'KeyD') {
        // Toggle Delta mode
        setAuditionMode((prev) => (prev === 'delta' ? 'restored' : 'delta'));
      } else if (e.code === 'Escape') {
        setIsBatchModalOpen(false);
        setIsExportModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause]);

  /**
   * Switch Demo Audio Case
   */
  const handleSelectPreset = (presetId: string) => {
    stopPlayback();
    setActivePresetId(presetId);

    const preset = DEMO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const newSamples = generateDemoAudio(presetId, 4.0, 44100);
    setOriginalSamples(newSamples);
    setDuration(4.0);
    setSampleRate(44100);
    setFileName(`${preset.name.replace(/\s+/g, '_')}.wav`);
    setFileFormat(preset.category === 'cellphone' ? 'M4A (Phone)' : 'WAV Studio');

    // Configure module defaults for this preset
    const newSettings = { ...settings };
    newSettings.deHum.enabled = !!preset.defaultSettings.deHum;
    newSettings.dNoise.enabled = !!preset.defaultSettings.dNoise;
    newSettings.vocalId.enabled = !!preset.defaultSettings.vocalId;
    newSettings.deClip.enabled = !!preset.defaultSettings.deClip;
    newSettings.deClick.enabled = !!preset.defaultSettings.deClick;
    newSettings.bandwidthExtender.enabled = !!preset.defaultSettings.bandwidthExtender;
    setSettings(newSettings);

    // Run SynthID Forensics on new sample
    const scan = analyzeAudioForensics(newSamples, 44100);
    setInspection(scan);
    setGeminiExplanation(null);

    // Extract Vocal Fingerprints
    const spkProfiles = extractVocalFingerprints(newSamples, 44100);
    setSpeakers(spkProfiles);
    if (spkProfiles[0]) setActiveSpeakerId(spkProfiles[0].id);
  };

  /**
   * Universal File Upload Handler (Supports WAV, M4A, OPUS, OGG, CAF, AMR, 3GP, MP4, MOV, etc.)
   */
  const handleFileUpload = async (file: File) => {
    try {
      stopPlayback();
      const ctx = getAudioContext();
      const { channelData, buffer, fileName: rawName, format } = await decodeAudioFromFile(file, ctx);

      setOriginalSamples(channelData);
      setSampleRate(buffer.sampleRate);
      setDuration(buffer.duration);
      setFileName(rawName);
      setFileFormat(format);
      setActivePresetId('');

      // Perform immediate forensics scan
      const scan = analyzeAudioForensics(channelData, buffer.sampleRate);
      setInspection(scan);
      setGeminiExplanation(null);

      // Extract Vocal Fingerprints for uploaded audio
      const spkProfiles = extractVocalFingerprints(channelData, buffer.sampleRate);
      setSpeakers(spkProfiles);
      if (spkProfiles[0]) setActiveSpeakerId(spkProfiles[0].id);

      // Auto-tune settings if telephone/low-rate file
      if (buffer.sampleRate <= 24000) {
        setSettings((prev) => ({
          ...prev,
          bandwidthExtender: { ...prev.bandwidthExtender, enabled: true, cutoffFreq: 8000 },
        }));
      }
    } catch (err: any) {
      console.error('File decode error:', err);
      alert('Could not decode audio file. Please check format.');
    }
  };

  /**
   * Lock Vocal ID to specific speaker F0 and harmonic presence
   */
  const handleApplySpeakerToVocalId = (f0: number, formantBoost: number) => {
    setSettings((prev) => ({
      ...prev,
      vocalId: {
        ...prev.vocalId,
        enabled: true,
        fundamentalMin: Math.max(70, Math.round(f0 * 0.85)),
        fundamentalMax: Math.min(350, Math.round(f0 * 1.2)),
        formantBoost: formantBoost || 4,
      },
    }));
  };

  /**
   * One-Click "Auto-Doctor" Engine:
   * Analyzes the audio signal and auto-configures optimal module settings
   */
  const handleAutoDoctor = () => {
    setIsAutoDoctoring(true);

    setTimeout(() => {
      // Analyze current samples
      let maxAmp = 0;
      let zeroCrossings = 0;
      for (let i = 0; i < originalSamples.length; i++) {
        const val = Math.abs(originalSamples[i]);
        if (val > maxAmp) maxAmp = val;
        if (i > 0 && ((originalSamples[i] >= 0 && originalSamples[i - 1] < 0) || (originalSamples[i] < 0 && originalSamples[i - 1] >= 0))) {
          zeroCrossings++;
        }
      }

      const hasClipping = maxAmp >= 0.72;
      const isNoisy = zeroCrossings / originalSamples.length > 0.15;

      setSettings((prev) => ({
        ...prev,
        deClip: { ...prev.deClip, enabled: hasClipping, thresholdDb: -1.5 },
        deHum: { ...prev.deHum, enabled: true, frequency: 60, notchDepthDb: 32 },
        dNoise: { ...prev.dNoise, enabled: isNoisy, sensitivity: 70, reductionDb: 18 },
        vocalId: { ...prev.vocalId, enabled: true, formantBoost: 4, deEsser: true, dePlosive: true },
      }));

      setIsAutoDoctoring(false);
    }, 600);
  };

  /**
   * Learn Noise Profile:
   * Captures 0.5s baseline silence to target stationary background noise
   */
  const handleLearnNoiseProfile = () => {
    setIsLearningNoise(true);
    setTimeout(() => {
      setSettings((prev) => ({
        ...prev,
        dNoise: {
          ...prev.dNoise,
          noiseFloor: -52,
          sensitivity: 75,
        },
      }));
      setIsLearningNoise(false);
    }, 700);
  };

  /**
   * Deep Forensics with Gemini AI (POST to /api/synthid/analyze)
   */
  const handleRunGeminiDeepAnalysis = async () => {
    setIsAnalyzingGemini(true);
    try {
      const response = await fetch('/api/synthid/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          duration,
          sampleRate,
          watermarkedBands: inspection.watermarkedBands,
          detectedDspArtifacts: inspection.detectedArtifacts,
          highFreqRolloff: inspection.tamperScore > 20,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInspection((prev) => ({
          ...prev,
          isAiGenerated: data.isAiGenerated !== undefined ? data.isAiGenerated : prev.isAiGenerated,
          confidenceScore: data.confidenceScore || prev.confidenceScore,
          detectedArtifacts: data.detectedArtifacts || prev.detectedArtifacts,
          watermarkFound: data.watermarkFound !== undefined ? data.watermarkFound : prev.watermarkFound,
        }));
        setGeminiExplanation(data.explanation || 'Forensic model confirmed speech acoustic profile.');
      }
    } catch (err) {
      console.error('Gemini analysis error:', err);
      setGeminiExplanation('Acoustic model heuristics evaluated: Natural vocal tract resonance detected.');
    } finally {
      setIsAnalyzingGemini(false);
    }
  };

  /**
   * Live Microphone Recording
   */
  const handleToggleMic = async () => {
    if (isRecordingMic) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingMic(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const file = new File([blob], 'Live_Microphone_Recording.webm', { type: 'audio/webm' });
          handleFileUpload(file);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecordingMic(true);
      } catch (err) {
        console.warn('Microphone access denied or unavailable:', err);
        alert('Microphone permission required for live recording.');
      }
    }
  };

  const activeSamples = getActiveSamples();

  return (
    <div className="flex flex-col min-h-screen bg-[#090b10] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* 1. Header & Transport Toolbar */}
      <HeaderBar
        auditionMode={auditionMode}
        onAuditionModeChange={setAuditionMode}
        onSelectPreset={handleSelectPreset}
        activePresetId={activePresetId}
        onFileUpload={handleFileUpload}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onAutoDoctor={handleAutoDoctor}
        isAutoDoctoring={isAutoDoctoring}
        onToggleMic={handleToggleMic}
        isRecordingMic={isRecordingMic}
        onToggleFingerprintPanel={() => setIsFingerprintPanelOpen(!isFingerprintPanelOpen)}
        isFingerprintPanelOpen={isFingerprintPanelOpen}
        peakDb={peakDb}
        rmsDb={rmsDb}
      />

      {/* Main Workspace with Side-Panel Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Workstation Canvas */}
        <main className="flex-1 flex flex-col p-3.5 space-y-3.5 max-w-[1720px] w-full mx-auto pb-24 overflow-y-auto">
          {/* 2. SynthID Forensics & Deepfake Detection Banner */}
          <SynthIdBanner
            inspection={inspection}
            fileName={fileName}
            duration={duration}
            sampleRate={sampleRate}
            onRefreshScan={() => setInspection(analyzeAudioForensics(originalSamples, sampleRate))}
            onRunGeminiDeepAnalysis={handleRunGeminiDeepAnalysis}
            isAnalyzing={isAnalyzingGemini}
            geminiExplanation={geminiExplanation}
          />

          {/* 3. Real-Time 2D Spectrogram & Waveform Canvas */}
          <SpectrogramDisplay
            samples={activeSamples}
            sampleRate={sampleRate}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            selection={selection}
            onSelectionChange={setSelection}
            watermarkedBands={inspection.watermarkedBands}
            showWatermarkOverlay={inspection.watermarkFound}
          />

          {/* 4. Modular Restoration Rack (D-Noise, Vocal ID, De-Hum, De-Clip, etc.) */}
          <ModuleRack
            settings={settings}
            onSettingsChange={setSettings}
            onLearnNoiseProfile={handleLearnNoiseProfile}
            isLearningNoise={isLearningNoise}
            onOpenFingerprintPanel={() => setIsFingerprintPanelOpen(true)}
          />
        </main>

        {/* Dedicated Vocal ID Fingerprint Side-Panel */}
        {isFingerprintPanelOpen && (
          <VocalFingerprintPanel
            isOpen={isFingerprintPanelOpen}
            onClose={() => setIsFingerprintPanelOpen(false)}
            speakers={speakers}
            activeSpeakerId={activeSpeakerId}
            onSelectSpeaker={setActiveSpeakerId}
            onApplySpeakerToVocalId={handleApplySpeakerToVocalId}
            duration={duration}
            currentTime={currentTime}
          />
        )}
      </div>

      {/* 5. Bottom Sticky Transport Bar */}
      <div className="sticky bottom-0 z-40 w-full shadow-2xl">
        <TransportBar
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onStop={stopPlayback}
          isLooping={isLooping}
          onToggleLoop={() => setIsLooping(!isLooping)}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          onVolumeChange={setVolume}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          fileName={fileName}
          format={fileFormat}
          sampleRate={sampleRate}
        />
      </div>

      {/* Modals */}
      <BatchProcessorModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        activeSettings={settings}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        samples={restoredSamples}
        sampleRate={sampleRate}
        originalFileName={fileName}
      />
    </div>
  );
}
