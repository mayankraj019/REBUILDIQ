/**
 * RebuildIQ Design Tokens
 * 
 * Strict Brand Palette:
 * - Navy: #14213D
 * - Cream: #F4EDE0
 * - Coral: #FF6B5B
 * 
 * Intentionally designed to be minimal, refined, high-contrast, and commercial-grade.
 * Zero glassmorphism, zero neon colors, zero excessive gradients or shadows.
 */

export const tokens = {
  colors: {
    brand: {
      navy: '#14213D',
      cream: '#F4EDE0',
      coral: '#FF6B5B',
    },
    surface: {
      canvas: '#F4EDE0',       // Warm primary canvas background
      card: '#FFFFFF',         // Crisp elevated white card surfaces
      subtle: '#ECE4D4',       // Slightly deepened cream for card headers / dividers
      dark: '#14213D',         // Structural deep navy for headers and code viewports
      overlay: 'rgba(20, 33, 61, 0.65)', // High-contrast navy backdrop for dialogs
    },
    text: {
      primary: '#14213D',      // Deep navy primary typography (12.8:1 contrast on white, 10.4:1 on cream)
      secondary: '#4A5568',    // Muted slate for secondary metadata and timestamps
      muted: '#718096',        // De-emphasized labels and placeholder copy
      inverse: '#F4EDE0',      // Warm cream for dark navy surfaces
      accent: '#FF6B5B',       // Coral text accent
    },
    border: {
      subtle: '#E2D7C3',       // Soft neutral border for cards and dividers
      strong: '#C8B99D',       // High-definition borders for active containers
      focus: '#14213D',        // High-contrast keyboard focus ring
      coral: '#FF6B5B',        // Coral accent border for active/selected states
    },
    interactive: {
      primary: '#FF6B5B',      // Coral primary action
      primaryHover: '#E85A4A', // Darkened coral on user hover
      primaryActive: '#D44A3A',// Further darkened coral on click/press
      secondary: '#14213D',    // Deep navy secondary action
      secondaryHover: '#1B2C52',
      ghostHover: '#ECE4D4',   // Subtle cream tint on ghost button hover
    },
    status: {
      success: {
        text: '#1B7A43',
        bg: '#EAF7EE',
        border: '#C3E6CB',
      },
      warning: {
        text: '#B45309',
        bg: '#FFFBEB',
        border: '#FDE68A',
      },
      error: {
        text: '#B91C1C',
        bg: '#FEF2F2',
        border: '#FECACA',
      },
      info: {
        text: '#1D4ED8',
        bg: '#EFF6FF',
        border: '#BFDBFE',
      },
    },
  },

  typography: {
    fonts: {
      sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    sizes: {
      xs: { fontSize: '0.75rem', lineHeight: '1rem' },         // 12px / 16px
      sm: { fontSize: '0.875rem', lineHeight: '1.25rem' },     // 14px / 20px
      base: { fontSize: '1rem', lineHeight: '1.5rem' },        // 16px / 24px
      lg: { fontSize: '1.125rem', lineHeight: '1.75rem' },     // 18px / 28px
      xl: { fontSize: '1.25rem', lineHeight: '1.75rem' },      // 20px / 28px
      '2xl': { fontSize: '1.5rem', lineHeight: '2rem' },       // 24px / 32px
      '3xl': { fontSize: '1.875rem', lineHeight: '2.25rem' },  // 30px / 36px
      '4xl': { fontSize: '2.25rem', lineHeight: '2.5rem' },    // 36px / 40px
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  spacing: {
    0: '0px',
    1: '0.25rem', // 4px
    2: '0.5rem',  // 8px
    3: '0.75rem', // 12px
    4: '1rem',    // 16px
    5: '1.25rem', // 20px
    6: '1.5rem',  // 24px
    8: '2rem',    // 32px
    10: '2.5rem', // 40px
    12: '3rem',   // 48px
    16: '4rem',   // 64px
    20: '5rem',   // 80px
  },

  layout: {
    maxWidths: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },
  },

  radii: {
    none: '0px',
    sm: '0.25rem', // 4px
    md: '0.375rem',// 6px
    lg: '0.5rem',  // 8px
    xl: '0.75rem', // 12px
    full: '9999px',
  },

  elevation: {
    flat: 'none',
    raised: '0 1px 3px 0 rgba(20, 33, 61, 0.05), 0 1px 2px -1px rgba(20, 33, 61, 0.05)',
    overlay: '0 4px 6px -1px rgba(20, 33, 61, 0.08), 0 2px 4px -2px rgba(20, 33, 61, 0.05)',
    modal: '0 10px 15px -3px rgba(20, 33, 61, 0.12), 0 4px 6px -4px rgba(20, 33, 61, 0.08)',
  },

  focus: {
    ring: '2px solid #14213D',
    ringOffset: '2px',
    ringOffsetColor: '#F4EDE0',
  },

  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  breakpoints: {
    mobile: '375px',
    tablet: '768px',
    desktop: '1280px',
    wide: '1440px',
  },
} as const;

export type DesignTokens = typeof tokens;
