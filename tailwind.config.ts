import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          900: "#0a1f14",
          800: "#0d2a1a",
          700: "#123823",
        },
        // Theme accent — driven by CSS vars so a single switch re-skins the app.
        grass: "rgb(var(--grass) / <alpha-value>)",
        neon: "rgb(var(--neon) / <alpha-value>)",
        gold: "#e9c97c",
        goldsoft: "#f3e2b8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgb(var(--grass) / 0.45)",
        lux: "0 14px 44px -14px rgba(0,0,0,0.6)",
        gold: "0 10px 36px -10px rgba(233,201,124,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
