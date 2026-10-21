import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Layers, Sliders, Eye, Sparkles } from 'lucide-react';
import { SpectralSelection } from '../dsp/types';

interface SpectrogramDisplayProps {
  samples: Float32Array | null;
  sampleRate: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  selection: SpectralSelection;
  onSelectionChange: (sel: SpectralSelection) => void;
  watermarkedBands?: number[];
  showWatermarkOverlay?: boolean;
}

type ColorMapType = 'magma' | 'cyan' | 'viridis';
type ViewMode = 'spectrogram' | 'waveform' | 'split';

export const SpectrogramDisplay: React.FC<SpectrogramDisplayProps> = ({
  samples,
  sampleRate,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  selection,
  onSelectionChange,
  watermarkedBands = [],
  showWatermarkOverlay = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [colorMap, setColorMap] = useState<ColorMapType>('magma');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 1.0x to 8.0x
  const [panOffset, setPanOffset] = useState<number>(0); // 0 to 1
  const [isPanning, setIsPanning] = useState(false);
  const dragStartX = useRef(0);
  const dragStartPan = useRef(0);

  // Frequency markers
  const freqTicks = [60, 150, 500, 1000, 2500, 5000, 10000, 18000];

  /**
   * Color lookup table for 256 intensity values
   */
  const colorLUT = useMemo(() => {
    const lut = new Uint8ClampedArray(256 * 4);

    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let r = 0, g = 0, b = 0;

      if (colorMap === 'magma') {
        // Black -> Dark Purple -> Crimson -> Warm Orange -> Bright Yellow
        if (t < 0.25) {
          const u = t / 0.25;
          r = Math.round(u * 50);
          g = Math.round(u * 10);
          b = Math.round(u * 80);
        } else if (t < 0.5) {
          const u = (t - 0.25) / 0.25;
          r = Math.round(50 + u * 135);
          g = Math.round(10 + u * 25);
          b = Math.round(80 - u * 30);
        } else if (t < 0.75) {
          const u = (t - 0.5) / 0.25;
          r = Math.round(185 + u * 65);
          g = Math.round(35 + u * 125);
          b = Math.round(50 - u * 40);
        } else {
          const u = (t - 0.75) / 0.25;
          r = 250;
          g = Math.round(160 + u * 95);
          b = Math.round(10 + u * 180);
        }
      } else if (colorMap === 'cyan') {
        // Deep obsidian -> Navy -> Azure -> Bioluminescent Cyan -> White
        if (t < 0.3) {
          const u = t / 0.3;
          r = Math.round(u * 10);
          g = Math.round(u * 30);
          b = Math.round(u * 70);
        } else if (t < 0.7) {
          const u = (t - 0.3) / 0.4;
          r = Math.round(10 + u * 10);
          g = Math.round(30 + u * 180);
          b = Math.round(70 + u * 160);
        } else {
          const u = (t - 0.7) / 0.3;
          r = Math.round(20 + u * 235);
          g = Math.round(210 + u * 45);
          b = 255;
        }
      } else {
        // Viridis
        r = Math.round(255 * (t < 0.5 ? 0.2 + t * 0.4 : 0.4 + (t - 0.5) * 1.1));
        g = Math.round(255 * (t < 0.5 ? t * 1.4 : 0.7 + (t - 0.5) * 0.5));
        b = Math.round(255 * (1 - Math.abs(t - 0.3) * 1.2));
      }

      const idx = i * 4;
      lut[idx] = Math.max(0, Math.min(255, r));
      lut[idx + 1] = Math.max(0, Math.min(255, g));
      lut[idx + 2] = Math.max(0, Math.min(255, b));
      lut[idx + 3] = 255;
    }

    return lut;
  }, [colorMap]);

  /**
   * Pre-computed STFT Spectrogram Matrix
   */
  const spectrogramData = useMemo(() => {
    if (!samples || samples.length === 0) return null;

    const fftSize = 512;
    const hopSize = 256;
    const numBins = fftSize / 2;
    const totalCols = Math.floor((samples.length - fftSize) / hopSize);
    if (totalCols <= 0) return null;

    // Hann window
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // Allocate matrix (numBins x totalCols)
    const matrix = new Uint8Array(numBins * totalCols);

    // Simplified discrete transform approximation for spectral energy
    // Sub-sample columns for performance if large file
    const maxCols = 800;
    const colStep = Math.max(1, Math.floor(totalCols / maxCols));
    const effectiveCols = Math.floor(totalCols / colStep);

    for (let c = 0; c < effectiveCols; c++) {
      const sampleOffset = c * colStep * hopSize;

      // Extract windowed frame
      const real = new Float32Array(fftSize);
      for (let j = 0; j < fftSize; j++) {
        real[j] = (samples[sampleOffset + j] || 0) * window[j];
      }

      // Fast Hartley/DFT energy estimate per octave/bin
      for (let b = 0; b < numBins; b++) {
        // Logarithmic frequency bin distribution
        const freqRatio = Math.pow(b / numBins, 1.8);
        const k = Math.max(1, Math.min(numBins - 1, Math.floor(freqRatio * numBins)));

        let re = 0;
        let im = 0;
        const angleStep = (2 * Math.PI * k) / fftSize;

        // Sample 32 points per bin for speed
        const stride = 16;
        for (let n = 0; n < fftSize; n += stride) {
          const angle = angleStep * n;
          re += real[n] * Math.cos(angle);
          im -= real[n] * Math.sin(angle);
        }

        const mag = Math.sqrt(re * re + im * im) * (stride / 4);
        // Log scale dB conversion: 0 to 255
        const db = 20 * Math.log10(mag + 1e-5);
        // Map -70dB to 0dB into 0 - 255
        const norm = Math.max(0, Math.min(255, Math.floor(((db + 70) / 70) * 255)));
        matrix[b * effectiveCols + c] = norm;
      }
    }

    return { matrix, numBins, cols: effectiveCols };
  }, [samples]);

  /**
   * Main Render Loop on Canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dynamically match internal canvas resolution to actual client container width
    if (canvas.clientWidth > 0 && Math.abs(canvas.width - canvas.clientWidth) > 4) {
      canvas.width = canvas.clientWidth;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, width, height);

    if (!samples || samples.length === 0) {
      // Empty placeholder state
      ctx.fillStyle = '#334155';
      ctx.font = '13px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NO AUDIO LOADED — DROP AUDIO/VIDEO OR SELECT PRESET ABOVE', width / 2, height / 2);
      return;
    }

    // View dimensions
    const visibleWidthRatio = 1 / zoomLevel;
    const maxPan = Math.max(0, 1 - visibleWidthRatio);
    const clampedPan = Math.max(0, Math.min(maxPan, panOffset));

    const startTime = clampedPan * duration;
    const visibleDuration = visibleWidthRatio * duration;
    const endTime = startTime + visibleDuration;

    // Calculate layout heights based on viewMode
    let specHeight = height;
    let waveHeight = 0;
    let waveY = 0;

    if (viewMode === 'waveform') {
      specHeight = 0;
      waveHeight = height;
      waveY = 0;
    } else if (viewMode === 'split') {
      specHeight = Math.floor(height * 0.65);
      waveHeight = height - specHeight;
      waveY = specHeight;
    }

    // 1. Draw Spectrogram
    if (specHeight > 0 && spectrogramData) {
      const { matrix, numBins, cols } = spectrogramData;
      const imgData = ctx.createImageData(width, specHeight);
      const data = imgData.data;

      const colStart = Math.floor(clampedPan * cols);
      const colEnd = Math.min(cols, Math.ceil((clampedPan + visibleWidthRatio) * cols));
      const colRange = Math.max(1, colEnd - colStart);

      for (let x = 0; x < width; x++) {
        const normX = x / width;
        const colIdx = Math.min(cols - 1, colStart + Math.floor(normX * colRange));

        for (let y = 0; y < specHeight; y++) {
          // Invert y: high frequency at top, low frequency at bottom
          const binIdx = Math.floor(((specHeight - 1 - y) / specHeight) * numBins);
          const intensity = matrix[binIdx * cols + colIdx];

          const lutIdx = intensity * 4;
          const pixelIdx = (y * width + x) * 4;

          data[pixelIdx] = colorLUT[lutIdx];
          data[pixelIdx + 1] = colorLUT[lutIdx + 1];
          data[pixelIdx + 2] = colorLUT[lutIdx + 2];
          data[pixelIdx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Draw Frequency Grid & Labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px "Geist Mono", monospace';
      ctx.textAlign = 'right';

      for (const freq of freqTicks) {
        if (freq < sampleRate / 2) {
          // Logarithmic position
          const normFreq = Math.pow(freq / (sampleRate / 2), 1 / 1.8);
          const yPos = specHeight - normFreq * specHeight;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(0, yPos);
          ctx.lineTo(width, yPos);
          ctx.stroke();
          ctx.setLineDash([]);

          const label = freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}kHz` : `${freq}Hz`;
          ctx.fillText(label, width - 8, yPos - 3);
        }
      }

      // Draw Watermark Overlay lines if enabled
      if (showWatermarkOverlay && watermarkedBands.length > 0) {
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = '#10b981';
        ctx.lineWidth = 1.5;

        for (const band of watermarkedBands) {
          const normFreq = Math.pow(band / (sampleRate / 2), 1 / 1.8);
          const yPos = specHeight - normFreq * specHeight;

          ctx.beginPath();
          ctx.moveTo(0, yPos);
          ctx.lineTo(width, yPos);
          ctx.stroke();

          ctx.fillText(`SynthID Carrier: ${band} Hz`, 140, yPos - 4);
        }
      }
    }

    // 2. Draw Waveform View
    if (waveHeight > 0) {
      // Waveform background
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, waveY, width, waveHeight);

      // Dividing hairline
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, waveY);
      ctx.lineTo(width, waveY);
      ctx.stroke();

      // Zero baseline
      const midY = waveY + waveHeight / 2;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      // Draw Waveform bars / envelope
      const startSample = Math.floor(clampedPan * samples.length);
      const endSample = Math.min(samples.length, Math.ceil((clampedPan + visibleWidthRatio) * samples.length));
      const sampleSpan = Math.max(1, endSample - startSample);
      const step = sampleSpan / width;

      ctx.fillStyle = '#38bdf8';
      for (let x = 0; x < width; x++) {
        const idx = Math.floor(startSample + x * step);
        let min = 0;
        let max = 0;
        const block = Math.max(1, Math.floor(step));

        for (let k = 0; k < block; k++) {
          const val = samples[idx + k] || 0;
          if (val < min) min = val;
          if (val > max) max = val;
        }

        const top = midY - max * (waveHeight * 0.44);
        const bottom = midY - min * (waveHeight * 0.44);
        const barH = Math.max(1.5, bottom - top);

        // Clip warning in red if near 0dB
        if (max > 0.95 || min < -0.95) {
          ctx.fillStyle = '#f43f5e';
        } else {
          ctx.fillStyle = '#38bdf8';
        }

        ctx.fillRect(x, top, 1.2, barH);
      }
    }

    // 3. Draw Spectral Selection Range Overlay
    if (selection.active && selection.fMin !== undefined && selection.fMax !== undefined) {
      const normMin = Math.pow(selection.fMin / (sampleRate / 2), 1 / 1.8);
      const normMax = Math.pow(selection.fMax / (sampleRate / 2), 1 / 1.8);
      const yBottom = specHeight - normMin * specHeight;
      const yTop = specHeight - normMax * specHeight;
      const bandHeight = Math.max(4, yBottom - yTop);

      ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.fillRect(0, yTop, width, bandHeight);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, yTop, width, bandHeight);

      ctx.fillStyle = '#06b6d4';
      ctx.font = '10px "Geist Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Selection: ${selection.fMin} Hz – ${selection.fMax} Hz`, 12, yTop + 14);
    }

    // 4. Draw Playhead Position
    if (duration > 0 && currentTime >= startTime && currentTime <= endTime) {
      const playheadX = ((currentTime - startTime) / visibleDuration) * width;

      // Glow beam
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Sharp core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead Top Cap
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    samples,
    sampleRate,
    currentTime,
    duration,
    viewMode,
    colorMap,
    zoomLevel,
    panOffset,
    spectrogramData,
    colorLUT,
    selection,
    watermarkedBands,
    showWatermarkOverlay,
  ]);

  /**
   * Handle Click to Seek & Drag to Pan
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!samples || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Shift-click or middle-click to Pan, regular click to Seek
    if (e.shiftKey || e.button === 1 || zoomLevel > 1.0) {
      setIsPanning(true);
      dragStartX.current = e.clientX;
      dragStartPan.current = panOffset;
    }

    // Direct Seek
    const visibleWidthRatio = 1 / zoomLevel;
    const maxPan = Math.max(0, 1 - visibleWidthRatio);
    const clampedPan = Math.max(0, Math.min(maxPan, panOffset));
    const targetTime = (clampedPan + (x / canvas.width) * visibleWidthRatio) * duration;
    onSeek(Math.max(0, Math.min(duration, targetTime)));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning || zoomLevel <= 1.0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const deltaX = dragStartX.current - e.clientX;
    const panDelta = (deltaX / canvas.width) * (1 / zoomLevel);
    const visibleWidthRatio = 1 / zoomLevel;
    const maxPan = Math.max(0, 1 - visibleWidthRatio);

    setPanOffset(Math.max(0, Math.min(maxPan, dragStartPan.current + panDelta)));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(8.0, z * 1.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(1.0, z / 1.5));
  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setPanOffset(0);
  };

  /**
   * Native mouse wheel zoom and trackpad horizontal pan
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const alpha = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      // Horizontal swipe / trackpad scroll => Pan
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
        setPanOffset((prevPan) => {
          const visibleWidthRatio = 1 / zoomLevel;
          const maxPan = Math.max(0, 1 - visibleWidthRatio);
          const panStep = (e.deltaX / rect.width) * visibleWidthRatio * 0.8;
          return Math.max(0, Math.min(maxPan, prevPan + panStep));
        });
        return;
      }

      // Vertical wheel or pinch => Zoom centered at cursor
      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoomLevel((prevZoom) => {
        const newZoom = Math.max(1.0, Math.min(8.0, prevZoom * zoomFactor));
        if (newZoom === prevZoom) return prevZoom;

        setPanOffset((prevPan) => {
          const oldVis = 1 / prevZoom;
          const newVis = 1 / newZoom;
          const newPan = prevPan + alpha * (oldVis - newVis);
          const maxPan = Math.max(0, 1 - newVis);
          return Math.max(0, Math.min(maxPan, newPan));
        });

        return newZoom;
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [zoomLevel]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-slate-950/90 rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden backdrop-blur-md"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-slate-800/90 gap-2 text-xs">
        {/* Left: View Mode Toggles */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-lg border border-slate-800/70">
          <button
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              viewMode === 'split'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Split 2D
          </button>
          <button
            onClick={() => setViewMode('spectrogram')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              viewMode === 'spectrogram'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Spectrogram
          </button>
          <button
            onClick={() => setViewMode('waveform')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              viewMode === 'waveform'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Waveform
          </button>
        </div>

        {/* Center: Color Map & Forensic Indicators */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>Palette:</span>
            <select
              value={colorMap}
              onChange={(e) => setColorMap(e.target.value as ColorMapType)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="magma">Magma / Inferno</option>
              <option value="cyan">Cyber Cyan</option>
              <option value="viridis">Viridis</option>
            </select>
          </div>

          {watermarkedBands.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>SynthID Watermark Bands Visible</span>
            </div>
          )}
        </div>

        {/* Right: Zoom & Pan controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-400 mr-1">
            Zoom: {zoomLevel.toFixed(1)}x
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1.0}
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            disabled={zoomLevel <= 1.0}
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition"
            title="Reset Zoom"
            aria-label="Reset Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative w-full h-80 bg-slate-950 cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={960}
          height={320}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full block"
        />

        {/* Pan navigation bar when zoomed in */}
        {zoomLevel > 1.0 && (
          <div className="absolute bottom-1 left-2 right-2 flex items-center gap-2 bg-slate-900/90 px-3 py-1 rounded-md border border-slate-700/60 shadow-lg text-[10px] font-mono text-slate-300">
            <span>PAN TIMELINE:</span>
            <input
              type="range"
              min="0"
              max={1 - 1 / zoomLevel}
              step="0.005"
              value={panOffset}
              onChange={(e) => setPanOffset(parseFloat(e.target.value))}
              className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Quick Spectral Frequency Selection Presets */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900/70 border-t border-slate-800/80 text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Target Range:</span>
          <button
            onClick={() => onSelectionChange({ active: true, fMin: 45, fMax: 75, tStart: 0, tEnd: duration })}
            className={`px-2 py-0.5 rounded transition ${
              selection.active && selection.fMin === 45
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            50/60Hz Hum
          </button>
          <button
            onClick={() => onSelectionChange({ active: true, fMin: 85, fMax: 280, tStart: 0, tEnd: duration })}
            className={`px-2 py-0.5 rounded transition ${
              selection.active && selection.fMin === 85
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            Vocal F0 (85-280Hz)
          </button>
          <button
            onClick={() => onSelectionChange({ active: true, fMin: 4500, fMax: 8500, tStart: 0, tEnd: duration })}
            className={`px-2 py-0.5 rounded transition ${
              selection.active && selection.fMin === 4500
                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300'
            }`}
          >
            Sibilance (5k-8kHz)
          </button>
          {selection.active && (
            <button
              onClick={() => onSelectionChange({ active: false, fMin: 0, fMax: 0, tStart: 0, tEnd: 0 })}
              className="text-slate-400 hover:text-slate-200 underline ml-1"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono">
          <span>
            TIME: <strong className="text-cyan-400">{currentTime.toFixed(2)}s</strong> / {duration.toFixed(2)}s
          </span>
          <span>
            SAMPLE RATE: <strong className="text-slate-200">{sampleRate} Hz</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
