/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src-web/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F2EBDD',
        paper: '#FAF5E9',
        rule: '#D4C49E',
        ink: '#2A2418',
        'ink-soft': '#6B5E45',
        'ink-muted': '#9A8A6B',
        sienna: '#A8552A',
        'sienna-soft': '#E8C9B5',
        leaf: '#5A7A3F',
        'leaf-soft': '#C8D6A8',
        sky: '#7B9CB3',
        focus: {
          top: '#2A2418',
          bottom: '#3A2E1F',
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 18px 45px rgba(42, 36, 24, 0.08)',
        glow: '0 0 0 6px rgba(168, 85, 42, 0.18)',
      },
      maxWidth: {
        garden: '1280px',
        compost: '1180px',
      },
    },
  },
  plugins: [],
};
