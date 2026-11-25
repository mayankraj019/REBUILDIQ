import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-900',
  };

  const iconStyles = {
    info: 'text-blue-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  };

  const icons = {
    info: <Info className={`w-4 h-4 shrink-0 ${iconStyles.info}`} />,
    success: <CheckCircle2 className={`w-4 h-4 shrink-0 ${iconStyles.success}`} />,
    warning: <AlertTriangle className={`w-4 h-4 shrink-0 ${iconStyles.warning}`} />,
    error: <AlertCircle className={`w-4 h-4 shrink-0 ${iconStyles.error}`} />,
  };

  return (
    <div
      role="alert"
      className={`flex items-start justify-between p-3.5 rounded-md border text-sm text-left ${variantStyles[variant]} ${className}`}
    >
      <div className="flex items-start space-x-2.5">
        <span className="mt-0.5">{icons[variant]}</span>
        <div>
          {title && <h5 className="font-semibold text-xs mb-0.5">{title}</h5>}
          <div className="text-xs leading-relaxed opacity-95">{children}</div>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="ml-3 -mr-1 -mt-1 p-1 rounded hover:bg-black/5 transition text-navy-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
