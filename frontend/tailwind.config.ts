import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Family light theme
        'family-bg':       '#f5f2ee',
        'family-surface':  '#ffffff',
        'family-surface2': '#f0ede8',
        'family-surface3': '#e8e4de',
        'family-text':     '#1a1814',
        'family-text2':    '#6b6760',
        'family-text3':    '#a09d99',
        'family-accent':   '#e85d3a',
        'family-sidebar':  '#1e1b18',
        // Legacy
        background: '#f5f2ee',
        surface: '#ffffff',
        'surface-2': '#f0ede8',
      },
      animation: {
        'bounce-once': 'bounce 0.5s ease-in-out 1',
        'scale-in':    'scaleIn 0.3s ease-out',
        'fade-in':     'fadeIn 0.3s ease-out',
        'pulse-green': 'pulseGreen 0.6s ease-out',
      },
      keyframes: {
        scaleIn:    { '0%': { transform: 'scale(0.8)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        fadeIn:     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        pulseGreen: { '0%': { backgroundColor: 'transparent' }, '50%': { backgroundColor: '#10b981' }, '100%': { backgroundColor: 'transparent' } },
      },
    },
  },
  plugins: [],
};

export default config;