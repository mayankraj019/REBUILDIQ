import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border border-dashed border-cream-300 bg-white/50 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-cream-200/80 text-navy-400 flex items-center justify-center mb-4">
        {icon}
      </div>

      <h3 className="text-base font-semibold text-navy-500 mb-1.5">{title}</h3>

      <p className="text-sm text-navy-400 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
