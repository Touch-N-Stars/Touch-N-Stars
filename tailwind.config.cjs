/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Aktiviert den Dark Mode
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '480px', // Fügt eine "xs"-Breakpoint für 480px hinzu
      },
      // Modals teleport to body, so these layers alone decide what covers what. New overlays
      // pick a layer here instead of a raw number.
      zIndex: {
        60: '60',
        70: '70',
        modal: '40', // Modal.vue default, below the navigation
        'modal-raised': '50', // level with the navigation, painted above it by DOM order
        'modal-nested': '60', // opened from a raised modal
        loading: '60', // LoadingOverlay: above modals, below the setup wizard
        overlay: '70', // full-screen surface such as the setup wizard
        'overlay-modal': '75', // modal opened from a full-screen surface
        'overlay-blocking': '76', // has to stay above those, e.g. LocationSyncModal
        dialog: '80', // backend dialogs and the PINS upgrade overlay
        messagebox: '90', // backend message box, can arrive on top of a dialog
        top: '1000', // topmost layer
        numberPad: '9998', // number pad overlay
        toast: '9999', // toast notifications
        lock: '10000', // screen lock overlay - above literally everything else
      },
    },
  },
  plugins: [],
};
