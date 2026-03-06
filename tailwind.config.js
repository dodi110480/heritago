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
            // ── ESSENTIALS ───────────────────────────────────────────────
            transparent: 'transparent',
            white: '#ffffff',
            black: '#000000',

            // ── PRIMITIVES ────────────────────────────────────────────────
            // Use these only when a semantic token doesn't fit.
            canvas: {
                white: '#ffffff',
                black: '#000000',
                transparent: 'transparent',
            },

            // ── NEUTRAL SCALE (formerly slate-*) ─────────────────────────
            // Text hierarchy on dark surfaces, subtle borders, muted labels.
            neutral: {
                100: '#f3f3f3ff',  // slate-100
                200: '#e2e8f0',  // slate-200
                300: '#cbd5e1',  // slate-300
                400: '#94a3b8',  // slate-400
                500: '#64748b',  // slate-500
                600: '#475569',  // slate-600
                700: '#334155',  // slate-700
                800: '#1e293b',  // slate-800
                900: '#0f172a',  // slate-900
                950: '#020617',  // slate-950
            },

            // ── UI SURFACE & SEMANTIC TOKENS ─────────────────────────────
            ui: {
                // Backgrounds
                bg: '#bcdfb6ff',
                bgSoft: '#6abe59ff',
                // Cards & Panels
                card: '#dee7dcff',
                cardHover: '#d6f0d0ff',
                panel: '#eef6ff',
                // Borders
                border: '#d8dadbff',
                borderStrong: '#757070ff',
                // Text
                textSoft: '#334155',
                textInputExample: '#cacacaff',
                // Overlays
                overlay: '#0f172a33',
                // Surface depth scale (formerly surface.*)
                surfaceLightest: '#ffffff',
                surface: '#dfeeff',
                surfaceDark: '#2c4a9bff',
                surfaceDarkest: '#b6b0b0ff',
            },

            // ── BRAND (Primary Color Scale) ───────────────────────────────
            brand: {
                50: '#f2fbff',
                100: '#def5ff',
                200: '#b7eaff',
                300: '#83d8ff',
                400: '#4bc1ff',
                500: '#1ea7ff',
                600: '#0b87e6',
                700: '#0e6bb8',
                800: '#125894',
                900: '#154a79',
                950: '#11304f',
                DEFAULT: '#1ea7ff',
            },

            // ── ACCENT (Semantic Roles, not color names) ──────────────────
            accent: {
                // Highlights, warnings, important badges (warm/gold tones)
                highlight: {
                    300: '#fbbf24',
                    400: '#f59e0b',
                    500: '#d97706',
                    600: '#b45309',
                },
                // Success states, active/alive indicators (green tones)
                success: {
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                },
                // Danger states, delete actions, errors (rose/red tones)
                danger: {
                    400: '#fb7185',
                    500: '#f43f5e',
                    600: '#e11d48',
                },
            },

            // ── STATE (Application state feedback colors) ─────────────────
            // Used for error messages, validation feedback, diagnostics.
            state: {
                error: '#f87171',  // red-400 – error text
                errorBg: '#ef4444',  // red-500 – error backgrounds/borders
                errorDeep: '#7f1d1d',  // red-900 – dark error surfaces
                errorSoft: '#fecaca',  // red-200 – soft error text
            },

            // ── WARN (Advisory / warning feedback colors) ─────────────────
            // Used for import warnings, destructive action notices.
            warn: {
                text: '#f97316',  // orange-500
                textSoft: '#fed7aa', // orange-200
                bg: '#f97316',  // orange-500
                border: '#f97316',  // orange-500
            },

            // ── GENDER INDICATOR TOKENS ───────────────────────────────────
            // Semantic colors for gender indicators across the app.
            // Use with opacity modifier: bg-gender-male/15 text-gender-male
            gender: {
                male: '#4bc1ff',   // reflects brand.400 (blue)
                female: '#f472b6',   // pink indicator
                neutral: '#94a3b8',   // neutral/unknown
            },
        },

        // ── TYPOGRAPHY ───────────────────────────────────────────────────
        extend: {
            fontFamily: {
                display: ['Playfair Display', 'Georgia', 'serif'],
                body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            fontSize: {
                'hero': ['3rem', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
                'heading': ['1.75rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.01em' }],
                'title': ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
                'label': ['0.6875rem', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '0.08em' }],
                'meta': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
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
