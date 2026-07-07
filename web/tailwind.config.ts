import type { Config } from "tailwindcss";

// Dark premium palette — tông tối, accent xanh lam/teal, viền mảnh.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0d12", // nền chính rất tối
          soft: "#0f141b", // panel
          card: "#141a23", // card
          hover: "#1a222d",
        },
        line: "#232c38", // viền mảnh
        ink: {
          DEFAULT: "#e7edf5", // text chính
          soft: "#9aa7b8", // text phụ
          faint: "#5c6a7d", // text mờ
        },
        accent: {
          DEFAULT: "#38bdf8", // sky-400
          soft: "#0ea5e9",
          teal: "#2dd4bf",
        },
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
