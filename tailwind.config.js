/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0e0b0c', 900: '#161113', 800: '#211a1c', 700: '#2e2427', 600: '#4a3b3f' },
        wine: { 400: '#d0627a', 500: '#b23a55', 600: '#8c2440', 700: '#6b1a31' },
        amber: { 300: '#f3c98b', 400: '#e8ad5a', 500: '#d48f30' },
        cream: '#f4ece4',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
