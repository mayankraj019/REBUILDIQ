import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'coral' | 'navy' | 'white';
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
  variant = 'coral',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-8 h-8 border-3',
  };

  const variantMap = {
    coral: 'border-coral-200 border-t-coral-500',
    navy: 'border-navy-200 border-t-navy-500',
    white: 'border-white/30 border-t-white',
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full animate-spin motion-reduce:animate-none ${sizeMap[size]} ${variantMap[variant]} ${className}`}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
