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
        grass: "#1db954",
        neon: "#39ff14",
        gold: "#e9c97c",
        goldsoft: "#f3e2b8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgba(29,185,84,0.45)",
        lux: "0 14px 44px -14px rgba(0,0,0,0.6)",
        gold: "0 10px 36px -10px rgba(233,201,124,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
