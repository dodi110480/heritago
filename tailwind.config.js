/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/**/*.{html,ts}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#020617',
                    DEFAULT: '#40cf23ff', // Heritago Blue Default
                },
                accent: {
                    purple: {
                        300: '#d8b4fe',
                        400: '#c084fc',
                        500: '#a855f7',
                        600: '#9333ea',
                    },
                    emerald: {
                        400: '#34d399',
                        500: '#10b981',
                        600: '#059669',
                    },
                    amber: {
                        400: '#fbbf24',
                        500: '#f59e0b',
                        600: '#d97706',
                    }
                },
                surface: {
                    light: '#334155',
                    DEFAULT: '#1E293B',
                    dark: '#0F172A',
                }
            },
            borderRadius: {
                '4xl': '2rem',
            },
            backdropBlur: {
                glass: '16px',
            },
            animation: {
                'pulse-photo': 'pulse-photo 4s infinite ease-in-out',
            },
            keyframes: {
                'pulse-photo': {
                    '0%, 100%': { transform: 'scale(1) translateY(0)', boxShadow: '0 0 0 rgba(96, 165, 250, 0)' },
                    '50%': { transform: 'scale(1.1) translateY(-5px)', boxShadow: '0 10px 20px rgba(96, 165, 250, 0.2)' },
                }
            }
        },
    },
    plugins: [],
}
