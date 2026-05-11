/** @type {import('tailwindcss').Config} */
export default {
  // Tell Tailwind which files to scan for class names.
  // It only includes classes it finds here in the final CSS bundle.
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Register JetBrains Mono as the "mono" font family.
      // The font itself is loaded via a <link> in index.html.
      fontFamily: {
        mono: ["JetBrains Mono", "Consolas", "monospace"],
        sans: ["DM Sans", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
