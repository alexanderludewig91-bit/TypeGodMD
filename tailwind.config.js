/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom dark theme colors
        dark: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          panel: '#2d2d2d',
          border: '#3c3c3c',
          hover: '#37373d',
          active: '#094771',
          text: '#cccccc',
          'text-muted': '#858585',
          accent: '#0e639c',
          'accent-hover': '#1177bb',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
