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

            // ── CORE TOKENS (Design Guide Rev. 2026) ─────────────────────
            brand: {
                50: '#f2fbff',
                100: '#def5ff',
                200: '#b7eaff',
                300: '#83d8ff',
                400: '#4bc1ff',
                500: '#1ea7ff', // Primary Action
                600: '#0b87e6',
                700: '#0e6bb8',
                DEFAULT: '#1ea7ff',
            },
            canvas: {
                DEFAULT: '#ffffff', // Light background
                dark: '#0f172a',    // Dark background
                white: '#ffffff',
                black: '#000000',
            },
            'accent-highlight': {
                300: '#fbbf24',
                500: '#d97706', // Focus/Selected
            },
            'accent-danger': {
                400: '#fb7185',
                500: '#f43f5e', // Errors/Delete
            },
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

            // Legacy/UI Support (Keep basic tokens for compatibility)
            ui: {
                bg: '#f8fafc',
                border: '#e2e8f0',
                card: '#ffffff',
            },

            state: {
                error: '#f87171',
                errorBg: '#ef4444',
            },

            gender: {
                male: '#4bc1ff',
                female: '#f472b6',
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

            // ── SHADOWS ──────────────────────────────────────────────────
            boxShadow: {
                'card': '0 10px 28px rgba(20,55,95,0.16), inset 0 1px 0 rgba(255,255,255,0.75)',
                'card-hover': '0 14px 34px rgba(20,55,95,0.22), inset 0 1px 0 rgba(255,255,255,0.90)',
                'modal': '0 20px 56px rgba(20,55,95,0.22)',
                'brand-glow': '0 0 20px rgba(30,167,255,0.25)',
                'brand-sm': '0 4px 15px rgba(30,167,255,0.20)',
                'danger-glow': '0 0 20px rgba(244,63,94,0.20)',
                'inner-ui': 'inset 0 1px 0 rgba(255,255,255,0.85)',
            },

            // ── BORDER RADIUS ─────────────────────────────────────────────
            borderRadius: {
                'card': '12px',
                'modal': '20px',
                'btn': '8px',
                '4xl': '2rem',
            },

            // ── Z-INDEX ───────────────────────────────────────────────────
            zIndex: {
                'navbar': '100',
                'dropdown': '200',
                'modal': '1000',
                'toast': '2000',
            },

            // ── ANIMATIONS ────────────────────────────────────────────────
            backdropBlur: {
                glass: '16px',
            },
            animation: {
                'pulse-photo': 'pulse-photo 4s infinite ease-in-out',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                'pulse-photo': {
                    '0%, 100%': { transform: 'scale(1) translateY(0)', boxShadow: '0 0 0 rgba(30,167,255,0)' },
                    '50%': { transform: 'scale(1.1) translateY(-5px)', boxShadow: '0 10px 20px rgba(30,167,255,0.2)' },
                },
                'fadeIn': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'slideUp': {
                    '0%': { opacity: '0', transform: 'translateY(12px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
