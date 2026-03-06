/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/**/*.{html,ts}",
    ],
    theme: {
        // Using `colors` (not `extend.colors`) to REPLACE Tailwind's entire
        // default palette. ALL colors must be defined here – no native
        // Tailwind color names (slate, red, white, …) available in templates.
        colors: {
            transparent: 'transparent',
            white: '#ffffff',
            black: '#000000',

            // ── BRAND: HERITAGE INDIGO & GOLD ────────────────────────────
            brand: {
                50: '#f5f7ff',
                100: '#ebf0fe',
                200: '#dce3fd',
                300: '#c2cdfa',
                400: '#a3aff5',
                500: '#6366f1', // Heritage Indigo (Modern Primary)
                600: '#4f46e5',
                700: '#4338ca',
                DEFAULT: '#6366f1',
            },

            // ── CANVAS: SOFT PAPER & MIDNIGHT ────────────────────────────
            canvas: {
                DEFAULT: '#fcfcfb', // Soft warm off-white
                dark: '#020617',    // Ultra-deep Midnight
                white: '#ffffff',
                black: '#000000',
            },

            // ── GLASS: CRYSTAL SYSTEM ────────────────────────────────────
            glass: {
                bg: 'rgba(255, 255, 255, 0.65)',
                border: 'rgba(0, 0, 0, 0.06)',
                'bg-dark': 'rgba(15, 23, 42, 0.60)',
                'border-dark': 'rgba(255, 255, 255, 0.08)',
            },

            // ── ACCENTS: GOLD, EMERALD, CRIMSON ──────────────────────────
            'accent-highlight': {
                300: '#fbbf24',
                500: '#d97706', // Heritage Gold (Focus/Selected)
                DEFAULT: '#d97706',
            },
            'accent-success': {
                400: '#34d399',
                500: '#10b981', // Nature Emerald
            },
            'accent-danger': {
                400: '#fb7185',
                500: '#f43f5e', // Rose Crimson
            },

            // ── NEUTRAL: SLATE SCALE ─────────────────────────────────────
            neutral: {
                50: '#f8fafc',
                100: '#f1f5f9',
                200: '#e2e8f0',
                300: '#cbd5e1',
                400: '#94a3b8',
                500: '#64748b', // Secondary text/borders
                600: '#475569',
                700: '#334155',
                800: '#1e293b',
                900: '#0f172a',
                950: '#020617',
            },

            // Legacy/UI Support
            ui: {
                bg: '#fcfcfb',
                border: '#e2e8f0',
                card: '#ffffff',
            },

            gender: {
                male: '#1316f1ff',   // Adjusted to Brand
                female: '#740d42ff',
                neutral: '#94a3b8',
            },
        },

        extend: {
            fontFamily: {
                body: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            fontSize: {
                'xs': ['0.8125rem', { lineHeight: '1.5' }],
                'sm': ['0.875rem', { lineHeight: '1.5' }],
                'base': ['1rem', { lineHeight: '1.625' }],
                'lg': ['1.25rem', { lineHeight: '1.5' }],
                'xl': ['1.5rem', { lineHeight: '1.4' }],
                '2xl': ['1.875rem', { lineHeight: '1.3' }],
                '3xl': ['2.25rem', { lineHeight: '1.2' }],
            },

            // ── SHADOWS: PREMIUM DEPTH ───────────────────────────────────
            boxShadow: {
                'card': '0 8px 30px rgba(0,0,0,0.04), 0 4px 10px rgba(0,0,0,0.02)',
                'card-hover': '0 20px 40px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.04)',
                'modal': '0 30px 60px rgba(0,0,0,0.12)',
                'brand-glow': '0 0 20px rgba(99,102,241,0.20)',
                'brand-sm': '0 4px 15px rgba(99,102,241,0.15)',
                'danger-glow': '0 0 20px rgba(244,63,94,0.15)',
            },

            borderRadius: {
                'card': '1.25rem',
                'modal': '1.5rem',
                'btn': '0.75rem',
            },

            zIndex: {
                'navbar': '100',
                'dropdown': '200',
                'modal': '1000',
                'toast': '2000',
            },

            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            },
            keyframes: {
                'fadeIn': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'slideUp': {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
