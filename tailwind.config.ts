import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink:      "#FF6B8A",
          "pink-light": "#FFB3C1",
          "pink-dark": "#E8536F",
          purple:    "#9B59B6",
          "purple-light": "#C39BD3",
          "purple-dark":  "#7D3C98",
          lavender:  "#D7BDE2",
          cream:     "#FFF5F7",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "page-turn": {
          "0%":   { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(-180deg)" },
        },
        "slide-up": {
          "0%":   { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "page-turn": "page-turn 0.6s ease-in-out forwards",
        "slide-up":  "slide-up 0.3s ease-out forwards",
        "fade-in":   "fade-in 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
