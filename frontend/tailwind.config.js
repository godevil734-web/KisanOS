/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#315C45',
          hover: '#264A37',
          light: '#EBF2EE',
          dark: '#4E8767',
        },
        sage: {
          DEFAULT: '#71856B',
          light: '#F0F3EF',
          dark: '#8B9E86',
        },
        copper: {
          DEFAULT: '#C58B4E',
          hover: '#B0783D',
          light: '#FAF3EB',
          dark: '#D49B5E',
        },
        charcoal: {
          DEFAULT: '#26332C',
          muted: '#637067',
          dark: '#EAECE8',
        },
        ivory: {
          DEFAULT: '#F7F5EF',
          surface: '#EFECE4',
          border: '#E5E0D5',
        },
        agri: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#315C45', // Realigned to muted forest green
          800: '#264A37',
          900: '#1A3326',
          950: '#0F2018',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans"', '"Noto Sans Devanagari"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
