'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type LogoVariant = 'full' | 'horizontal' | 'mark' | 'text' | 'image';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LogoTheme = 'default' | 'inverted';

export interface LogoProps {
  /** Display variant of the logo */
  variant?: LogoVariant;
  /** Predefined size scale */
  size?: LogoSize;
  /** Color theme: default (navy + coral) or inverted (white + coral for dark backgrounds) */
  theme?: LogoTheme;
  /** Whether to wrap the logo in a Next.js Link pointing to home ('/') */
  asLink?: boolean;
  /** Custom destination URL when asLink is true */
  href?: string;
  /** Whether to display the "AI AGENT" subtitle (applicable to 'full' variant) */
  showSubtitle?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Use transparent PNG raster asset instead of vector SVG */
  useImage?: boolean;
}

const sizeConfig: Record<
  LogoSize,
  {
    markSize: number;
    height: number;
    textSize: string;
    subtextSize: string;
    gap: string;
    imageWidth: number;
    imageHeight: number;
  }
> = {
  xs: {
    markSize: 22,
    height: 22,
    textSize: 'text-sm font-bold',
    subtextSize: 'text-[9px] tracking-[0.2em]',
    gap: 'space-x-1.5',
    imageWidth: 96,
    imageHeight: 28,
  },
  sm: {
    markSize: 28,
    height: 28,
    textSize: 'text-base font-bold',
    subtextSize: 'text-[10px] tracking-[0.22em]',
    gap: 'space-x-2',
    imageWidth: 120,
    imageHeight: 36,
  },
  md: {
    markSize: 36,
    height: 36,
    textSize: 'text-xl font-bold',
    subtextSize: 'text-xs tracking-[0.25em]',
    gap: 'space-x-3',
    imageWidth: 154,
    imageHeight: 46,
  },
  lg: {
    markSize: 48,
    height: 48,
    textSize: 'text-2xl font-bold',
    subtextSize: 'text-sm tracking-[0.28em]',
    gap: 'space-x-3.5',
    imageWidth: 200,
    imageHeight: 60,
  },
  xl: {
    markSize: 64,
    height: 64,
    textSize: 'text-4xl font-extrabold',
    subtextSize: 'text-base tracking-[0.3em]',
    gap: 'space-x-4',
    imageWidth: 280,
    imageHeight: 84,
  },
};

/**
 * RebuildIQ Logo Mark (Vector SVG)
 * Features the signature minimalist head profile in Navy with the Coral AI spark.
 */
export const LogoMark: React.FC<{
  size?: number;
  theme?: LogoTheme;
  className?: string;
}> = ({ size = 36, theme = 'default', className = '' }) => {
  const strokeColor = theme === 'inverted' ? '#FFFFFF' : '#14213D';
  const sparkColor = '#FF6B5B';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block flex-shrink-0 transition-transform ${className}`}
      aria-hidden="true"
    >
      {/* Head Profile Outline */}
      <path
        d="M 82 92 C 82 82 81 72 85 62 C 89 52 88 40 82 30 C 76 20 65 14 52 14 C 38 14 27 22 22 35 C 20 40 21 44 19 48 C 17 52 12 55 12 57 C 14 59 18 60 19 62 C 17 64 16 66 18 68 C 20 70 24 72 23 75 C 22 79 24 83 28 86 C 34 91 42 92 45 92"
        stroke={strokeColor}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Coral 4-Point AI Spark */}
      <path
        d="M 55 31 Q 55 49 73 49 Q 55 49 55 67 Q 55 49 37 49 Q 55 49 55 31 Z"
        fill={sparkColor}
      />
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  theme = 'default',
  asLink = false,
  href = '/',
  showSubtitle = true,
  className = '',
  useImage = false,
}) => {
  const config = sizeConfig[size];
  const textColor = theme === 'inverted' ? 'text-white' : 'text-navy-500';
  const subtitleColor = theme === 'inverted' ? 'text-cream-200' : 'text-navy-400';
  const dividerColor = theme === 'inverted' ? 'bg-white/40' : 'bg-navy-500';

  // Raster Image Rendering
  if (useImage || variant === 'image') {
    const imgContent = (
      <div className={`relative inline-flex items-center ${className}`}>
        <Image
          src="/brand/logo.png"
          alt="RebuildIQ — AI Agent"
          width={config.imageWidth}
          height={config.imageHeight}
          priority
          className="object-contain"
        />
      </div>
    );

    if (asLink) {
      return (
        <Link href={href} aria-label="RebuildIQ Home" className="inline-flex items-center">
          {imgContent}
        </Link>
      );
    }
    return imgContent;
  }

  // Variant: Mark Only
  if (variant === 'mark') {
    const markContent = (
      <LogoMark size={config.markSize} theme={theme} className={className} />
    );

    if (asLink) {
      return (
        <Link href={href} aria-label="RebuildIQ Home" className="inline-flex items-center">
          {markContent}
        </Link>
      );
    }
    return markContent;
  }

  // Variant: Text Only
  if (variant === 'text') {
    const textContent = (
      <span className={`tracking-tight ${config.textSize} ${textColor} ${className}`}>
        REBUILD<span className="text-coral-500">IQ</span>
      </span>
    );

    if (asLink) {
      return (
        <Link href={href} aria-label="RebuildIQ Home" className="inline-flex items-center">
          {textContent}
        </Link>
      );
    }
    return textContent;
  }

  // Variant: Full Brand Lockup (Mark + Vertical Line + REBUILDIQ + AI AGENT)
  if (variant === 'full') {
    const fullContent = (
      <div className={`inline-flex items-center ${config.gap} select-none ${className}`}>
        <LogoMark size={config.markSize} theme={theme} />

        {/* Vertical Divider */}
        <div
          className={`w-[2px] rounded-full ${dividerColor}`}
          style={{ height: `${config.markSize * 0.8}px` }}
        />

        {/* Typography Block */}
        <div className="flex flex-col justify-center leading-none">
          <span className={`tracking-tight ${config.textSize} ${textColor}`}>
            REBUILD<span className="text-coral-500">IQ</span>
          </span>
          {showSubtitle && (
            <span
              className={`font-semibold uppercase tracking-widest mt-1 ${config.subtextSize} ${subtitleColor}`}
            >
              AI AGENT
            </span>
          )}
        </div>
      </div>
    );

    if (asLink) {
      return (
        <Link href={href} aria-label="RebuildIQ Home" className="inline-flex items-center hover:opacity-95 transition-opacity">
          {fullContent}
        </Link>
      );
    }
    return fullContent;
  }

  // Default Variant: Horizontal Lockup (Mark + REBUILDIQ)
  const horizontalContent = (
    <div className={`inline-flex items-center ${config.gap} select-none ${className}`}>
      <LogoMark size={config.markSize} theme={theme} />
      <span className={`tracking-tight ${config.textSize} ${textColor}`}>
        REBUILD<span className="text-coral-500">IQ</span>
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link href={href} aria-label="RebuildIQ Home" className="inline-flex items-center hover:opacity-95 transition-opacity">
        {horizontalContent}
      </Link>
    );
  }

  return horizontalContent;
};
