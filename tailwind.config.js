/** @type {import('tailwindcss').Config} */
// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
  myaPink: '#ffe4f0',
  myaText: '#171717',
  myaAccent: '#ff69b4',
},

      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      fontSize: {
        hero: '2.5rem',
        heading: '1.875rem',
        subheading: '1.25rem',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
toast.success('Submitted!', {
  style: {
    background: '#ff69b4',
    color: '#fff',
    fontWeight: '600',
  },
});
