/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        hf: {
          green: { 50: "#E8F5E9", 100: "#C8E6C9", 500: "#4CAF50", 700: "#2E7D32", 900: "#1B5E20" },
          dark: { 50: "#1a2a1a", 100: "#0d150d", 200: "#0a0f0a" },
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
