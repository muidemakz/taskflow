export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2357d9',
        bg: '#f6f8fb',
        border: '#dbe3ee',
        text: '#172033',
        muted: '#59677c',
        success: '#177842'
      },
      boxShadow: {
        card: '0 12px 30px rgba(15,23,42,.05)'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
