/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        themeGreen: {
          light: "#e8f5e9",
          DEFAULT: "#2e7d32",
          dark: "#1b5e20",
        },
      },
    },
  },
  plugins: [],
};
