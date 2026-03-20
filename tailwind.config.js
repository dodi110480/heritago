/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./src/**/*.{html,ts,tsx,js,jsx}",          // alle gängigen Endungen
        "./src/**/*.component.ts",   // für inline templates
        "./index.html",                             // falls root index.html Klassen hat
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
                50: '#f6fff5ff',
                100: '#feefebff',
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
                DEFAULT: '#8cc4c1ff', // Soft warm off-white
                dark: '#020617',    // Ultra-deep Midnight
                white: '#ffffff',
                black: '#000000',
            },

            // ── GLASS: CRYSTAL SYSTEM ────────────────────────────────────
            glass: {
                bg: 'rgba(255, 255, 255, 0.7)',
                border: 'rgba(255, 255, 255, 0.40)',
                'bg-dark': 'rgba(15, 23, 42, 0.75)',
                'border-dark': 'rgba(255, 255, 255, 0.10)',
            },

            // ── ACCENTS: GOLD, EMERALD, CRIMSON ──────────────────────────
            'accent-highlight': {
                300: '#fcd34d',
                400: '#fbbf24',
                500: '#d97706', // Heritage Gold (Focus/Selected)
                600: '#b45309',
                700: '#92400e',
                DEFAULT: '#d97706',
            },
            'accent-success': {
                300: '#6ee7b7',
                400: '#34d399',
                500: '#10b981', // Nature Emerald
                600: '#059669',
                700: '#047857',
            },
            'accent-danger': {
                300: '#fda4af',
                400: '#fb7185',
                500: '#f43f5e', // Rose Crimson
                600: '#e11d48',
                700: '#be123c',
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

            // Alias for convenience and to fix build errors using slate classes
            slate: {
                50: '#f8fafc',
                100: '#f1f5f9',
                200: '#e2e8f0',
                300: '#cbd5e1',
                400: '#94a3b8',
                500: '#64748b',
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

            'accent-violet': {
                300: '#c4b5fd',
                400: '#a78bfa',
                500: '#8b5cf6',
                600: '#7c3aed',
                700: '#6d28d9',
            },

            gender: {
                male: '#4f46e5',   // Indigo-600
                female: '#db2777', // Rose-600
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
                'xs': ['0.75rem', { lineHeight: '1.5' }],     // Verkleinert von 0.8125rem
                'sm': ['0.8125rem', { lineHeight: '1.5' }],   // Verkleinert von 0.875rem
                'base': ['0.9375rem', { lineHeight: '1.6' }], // Verkleinert von 1rem
                'lg': ['1.125rem', { lineHeight: '1.5' }],    // Verkleinert von 1.25rem
                'xl': ['1.25rem', { lineHeight: '1.4' }],     // Verkleinert von 1.5rem
                '2xl': ['1.5rem', { lineHeight: '1.3' }],     // Verkleinert von 1.875rem
                '3xl': ['2rem', { lineHeight: '1.2' }],        // Verkleinert von 2.25rem
            },

            // ── SHADOWS: PREMIUM DEPTH ───────────────────────────────────
            boxShadow: {
                'card-light': '0 10px 30px -15px rgba(0, 0, 0, 0.45), 0 15px 30px -10px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
                'card-dark': '0 35px 70px -15px rgba(0, 0, 0, 0.6), 0 20px 40px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
                'card-hover': '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                'modal': '0 35px 60px -15px rgba(0, 0, 0, 0.5)',
                'brand-glow': '0 0 25px rgba(99,102,241,0.4)',
                'brand-sm': '0 4px 12px rgba(99,102,241,0.25)',
                'danger-glow': '0 0 25px rgba(244,63,94,0.4)',
                'inner-glow': 'inset 0 1px 1px rgba(255, 255, 255, 0.15)',
            },

            borderRadius: {
                'card': '0.2rem', // Filigranere Rundung (von 1.25rem)
                'modal': '0.4rem',   // Filigranere Rundung (von 1.5rem)
                'btn': '0.2rem',   // Filigranere Rundung (von 0.75rem)
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
