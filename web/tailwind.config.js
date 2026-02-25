/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0a1a',
          1: '#0f0f23',
          2: '#161629',
          3: '#1c1c35',
          4: '#232340',
          5: '#2a2a4a',
        },
        border: {
          DEFAULT: '#262640',
          light: '#333355',
        },
        accent: {
          blue: '#4361ee',
          green: '#2ec4b6',
          success: '#06d6a0',
          warning: '#ffd166',
          error: '#ef476f',
          purple: '#7209b7',
          orange: '#fb8500',
        },
        text: {
          primary: '#f2f2f7',
          secondary: '#8e8ea0',
          tertiary: '#5a5a72',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.15s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}
