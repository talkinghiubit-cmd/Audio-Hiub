import React, { useState, useRef, useCallback } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo';
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  defaultValue = min,
  color = 'cyan',
  onChange,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(value);

  // Map value to angle (-135deg to +135deg = 270 deg total range)
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + norm * 270;

  const colorStyles = {
    cyan: { stroke: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
    emerald: { stroke: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
    amber: { stroke: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
    rose: { stroke: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' },
    indigo: { stroke: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },
  }[color];

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = dragStartY.current - moveEvent.clientY;
      const range = max - min;
      // Sensitivity: 150px drag covers the full range
      const deltaVal = (deltaY / 150) * range;
      let newVal = dragStartValue.current + deltaVal;

      if (step) {
        newVal = Math.round(newVal / step) * step;
      }
      newVal = Math.max(min, Math.min(max, newVal));
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    onChange(defaultValue);
  };

  // SVG arc calculation
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  // Arc length is 270/360 = 0.75 of circumference
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength * (1 - norm);

  return (
    <div
      className={`flex flex-col items-center select-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="relative w-12 h-12 cursor-ns-resize flex items-center justify-center group"
        onMouseDown={handleMouseDown}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            onChange(Math.min(max, value + (step || 1)));
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            onChange(Math.max(min, value - (step || 1)));
          }
        }}
      >
        <svg className="w-12 h-12 -rotate-135" viewBox="0 0 44 44">
          {/* Background Track */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active Colored Arc */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke={colorStyles.stroke}
            strokeWidth="3.5"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              filter: isDragging ? `drop-shadow(0 0 4px ${colorStyles.glow})` : undefined,
              transition: isDragging ? 'none' : 'stroke-dashoffset 0.1s ease-out',
            }}
          />
        </svg>

        {/* Knob Core with indicator notch */}
        <div
          className={`absolute w-7 h-7 rounded-full bg-gradient-to-b from-slate-700 to-slate-900 border border-slate-600/70 shadow-md flex items-center justify-center transition-transform ${
            isDragging ? 'scale-105 border-slate-400' : 'group-hover:border-slate-500'
          }`}
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div
            className="w-0.5 h-2.5 rounded-full mb-3"
            style={{ backgroundColor: colorStyles.stroke }}
          />
        </div>
      </div>

      {/* Label and Value */}
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mt-1">
        {label}
      </span>
      <span className="text-xs font-mono font-semibold text-slate-200">
        {value}
        <span className="text-[10px] text-slate-400 ml-0.5">{unit}</span>
      </span>
    </div>
  );
};
