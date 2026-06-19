/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      colors: {
        primary: "#1a1a2e",
        secondary: "#16213e",
        accent: "#e94560",
        crewmate: "#3b82f6",
        impostor: "#ef4444",
        surface: "#0f3460",
      },
    },
  },
  plugins: [],
};
