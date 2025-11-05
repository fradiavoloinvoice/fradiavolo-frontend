/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'fradiavolo-red': '#C41E3A',
        'fradiavolo-red-dark': '#A31627',
        'fradiavolo-cream': '#FFF8DC',
        'fradiavolo-cream-dark': '#F5F5DC',
        'fradiavolo-charcoal': '#2C2C2C',
        'fradiavolo-charcoal-light': '#4A4A4A',
        'fradiavolo-green': '#28A745',
        'fradiavolo-green-dark': '#1E7E34',
        'fradiavolo-orange': '#FF8C00',
        'fradiavolo-gold': '#FFD700'
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'fradiavolo': '0 10px 25px rgba(196, 30, 58, 0.15)',
        'fradiavolo-lg': '0 20px 40px rgba(196, 30, 58, 0.2)',
      }
    },
  },
  plugins: [],
}