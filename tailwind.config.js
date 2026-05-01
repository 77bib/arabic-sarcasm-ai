/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f17",
        mist: "#e6eefc",
        sapphire: "#1a4dff",
        coral: "#ff6b6b",
        mint: "#37d39a",
        sand: "#f3f0e8",
      },
      boxShadow: {
        glow: "0 0 40px rgba(26, 77, 255, 0.25)",
      },
    },
  },
  plugins: [],
};
