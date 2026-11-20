/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface-2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)',
          ink: 'rgb(var(--c-accent-ink) / <alpha-value>)',
        },
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--c-danger-soft) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        'warn-soft': 'rgb(var(--c-warn-soft) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
        'info-soft': 'rgb(var(--c-info-soft) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Noto Sans',
          'Noto Sans Telugu',
          'Noto Sans Devanagari',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 28 22 / 0.04), 0 8px 24px -12px rgb(16 28 22 / 0.12)',
        pop: '0 12px 40px -12px rgb(16 28 22 / 0.28), 0 2px 8px rgb(16 28 22 / 0.06)',
        ring: '0 0 0 3px rgb(var(--c-accent) / 0.18)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'scan-line': {
          '0%': { top: '7%', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { top: '93%', opacity: '0' },
        },
        draw: {
          '0%': { strokeDashoffset: '48' },
          '100%': { strokeDashoffset: '0' },
        },
        pop: {
          '0%': { transform: 'scale(0.55)', opacity: '0' },
          '62%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '0' },
          '18%': { opacity: '0.9' },
          '100%': { transform: 'translateY(54px) rotate(200deg)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        'scan-line': 'scan-line 2.1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        draw: 'draw 700ms 220ms ease-out forwards',
        pop: 'pop 460ms cubic-bezier(0.22, 1, 0.36, 1) both',
        confetti: 'confetti 1.9s ease-out infinite',
      },
    },
  },
  plugins: [],
};
