import React, { forwardRef, useId } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      errorMessage,
      id,
      className = '',
      disabled,
      required,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    const hasError = Boolean(errorMessage);

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold uppercase tracking-wider text-navy-500 mb-1.5 select-none"
          >
            {label}
            {required && <span className="text-coral-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          rows={rows}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? errorId : helperText ? helperId : undefined
          }
          className={`w-full rounded-md bg-white border text-sm text-navy-500 placeholder-navy-300 transition-colors p-3 resize-y ${
            hasError
              ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
              : 'border-cream-300 hover:border-cream-400 focus:border-navy-500 focus:ring-1 focus:ring-navy-500'
          } focus:outline-none disabled:bg-cream-100 disabled:text-navy-300 disabled:cursor-not-allowed ${className}`}
          {...props}
        />

        {hasError && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600 font-medium">
            {errorMessage}
          </p>
        )}

        {!hasError && helperText && (
          <p id={helperId} className="mt-1.5 text-xs text-navy-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
