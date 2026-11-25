import React, { forwardRef } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base styles: accessible focus rings, typography, transition
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100 disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs space-x-1.5 h-8',
      md: 'px-4 py-2 text-sm space-x-2 h-10',
      lg: 'px-6 py-3 text-base space-x-2.5 h-12',
    };

    const variantStyles = {
      primary:
        'bg-coral-500 text-white hover:bg-coral-600 active:bg-coral-700 shadow-sm border border-transparent',
      secondary:
        'bg-navy-500 text-white hover:bg-navy-600 active:bg-navy-700 shadow-sm border border-transparent',
      outline:
        'border border-cream-300 bg-white text-navy-500 hover:bg-cream-50 hover:border-navy-200 active:bg-cream-100',
      ghost:
        'text-navy-500 hover:bg-cream-200/60 active:bg-cream-200 border border-transparent',
      danger:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm border border-transparent',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading && (
          <Spinner
            size="sm"
            variant={variant === 'primary' || variant === 'secondary' || variant === 'danger' ? 'white' : 'navy'}
          />
        )}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
