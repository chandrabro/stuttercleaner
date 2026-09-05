import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C232B",
        paper: "#F1F3F4",
        panel: "#FFFFFF",
        line: "#DCE1E4",
        mute: "#6B7580",
        teal: {
          DEFAULT: "#2E7D6B",
          dark: "#1F5A4C",
          light: "#DCEEE8",
        },
        amber: {
          DEFAULT: "#C97A2B",
          light: "#F5E3CE",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
