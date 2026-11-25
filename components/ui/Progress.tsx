import React from 'react';

export interface ProgressProps {
  value: number; // 0 to 100
  label?: string;
  showPercent?: boolean;
  className?: string;
  isIndeterminate?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  label,
  showPercent = false,
  className = '',
  isIndeterminate = false,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full text-left ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-xs font-medium text-navy-500 mb-1.5">
          {label && <span>{label}</span>}
          {showPercent && !isIndeterminate && <span>{Math.round(clampedValue)}%</span>}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full bg-cream-200 rounded-full h-2 overflow-hidden border border-cream-300"
      >
        <div
          className={`h-full bg-coral-500 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none ${
            isIndeterminate ? 'w-1/3 animate-pulse' : ''
          }`}
          style={isIndeterminate ? undefined : { width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
