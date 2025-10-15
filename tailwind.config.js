/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts}',
    './public/**/*.{html,js}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0d6efd', // Bootstrap primary
          50: '#e7f1ff',
          100: '#cfe3ff',
          200: '#9fc8ff',
          300: '#6facff',
          400: '#3f91ff',
          500: '#0d6efd',
          600: '#0a56ca',
          700: '#073e97',
          800: '#052664',
          900: '#021e4d'
        },
        brand: '#7c3aed',
        brand2: '#22d3ee'
      },
      borderRadius: {
        'xl': '18px'
      },
      boxShadow: {
        card: '0 10px 30px rgba(16,24,40,.25)',
        cardHover: '0 24px 60px rgba(16,24,40,.35)'
      },
      fontFamily: {
        sans: ['ui-sans-serif','system-ui','Segoe UI','Roboto','Helvetica Neue','Arial','Noto Sans','Liberation Sans','Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol']
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
