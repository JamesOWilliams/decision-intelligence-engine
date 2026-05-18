/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            fontFamily: {
                heading: ['Newsreader', 'serif'],
                body: ['"IBM Plex Sans"', 'sans-serif'],
                mono: ['"IBM Plex Mono"', 'monospace'],
            },
            colors: {
                bone: '#F4F4F0',
                surface: '#FFFFFF',
                sunken: '#EBEBE6',
                ink: '#0A0A0A',
                graphite: '#525252',
                slate2: '#737373',
                hairline: '#E5E5DF',
                oxblood: '#7F1D1D',
                moss: '#2E5C31',
                amber2: '#B45309',
                // shadcn passthrough (kept for any radix components that need it)
                background: '#F4F4F0',
                foreground: '#0A0A0A',
                border: '#E5E5DF',
                input: '#E5E5DF',
                ring: '#0A0A0A',
                primary: { DEFAULT: '#0A0A0A', foreground: '#FFFFFF' },
                secondary: { DEFAULT: '#EBEBE6', foreground: '#0A0A0A' },
                muted: { DEFAULT: '#EBEBE6', foreground: '#525252' },
                accent: { DEFAULT: '#7F1D1D', foreground: '#FFFFFF' },
                destructive: { DEFAULT: '#7F1D1D', foreground: '#FFFFFF' },
                card: { DEFAULT: '#FFFFFF', foreground: '#0A0A0A' },
                popover: { DEFAULT: '#FFFFFF', foreground: '#0A0A0A' },
            },
            borderRadius: {
                lg: '0px',
                md: '0px',
                sm: '0px',
            },
            keyframes: {
                'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
                'bar-grow': { from: { width: '0%' }, to: { width: 'var(--bar-w)' } },
            },
            animation: {
                'fade-in': 'fade-in 400ms ease-out both',
                'bar-grow': 'bar-grow 700ms cubic-bezier(0.16, 1, 0.3, 1) both',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
};
