import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // RebuildIQ Approved Brand Palette
        brand: {
          navy: '#14213D',
          cream: '#F4EDE0',
          coral: '#FF6B5B',
        },
        navy: {
          50: '#F0F3F9',
          100: '#D9E0EF',
          200: '#B3C2DF',
          300: '#8DA3CF',
          400: '#4D6EA8',
          500: '#14213D', // Primary Navy
          600: '#101A31',
          700: '#0C1425',
          800: '#080D1A',
          900: '#04070D',
        },
        cream: {
          50: '#FAF7F2',
          100: '#F4EDE0', // Primary Cream
          200: '#EBDDC7',
          300: '#E2D7C3', // Border Subtle
          400: '#C8B99D',
          500: '#AD9A77',
        },
        coral: {
          50: '#FFF0EE',
          100: '#FFE1DD',
          200: '#FFC2BB',
          300: '#FFA499',
          400: '#FF8677',
          500: '#FF6B5B', // Primary Coral Accent
          600: '#E65646',
          700: '#CC4131',
          800: '#993025',
          900: '#662018',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
