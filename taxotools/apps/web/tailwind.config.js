/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Apple UK Store tokens + legacy ink/accent aliases
        apple: {
          bg: "var(--bg-main)",
          panel: "var(--bg-panel)",
          hero: "var(--bg-hero)",
          text: "var(--text-main)",
          inverse: "var(--text-inverse)",
          muted: "var(--text-secondary)",
          blue: "var(--accent-blue)",
          link: "var(--link-blue)",
          "link-hover": "var(--link-blue-hover)",
          border: "var(--border-subtle)",
        },
        ink: {
          950: "var(--text-main)",
          900: "var(--text-main)",
          800: "#2d2d2f",
          700: "#424245",
          500: "var(--text-secondary)",
          300: "#a1a1a6",
          100: "var(--border-subtle)",
          50: "var(--bg-main)",
        },
        accent: {
          DEFAULT: "var(--accent-blue)",
          dark: "var(--link-blue-hover)",
          soft: "#e8f2ff",
        },
        warn: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        display: [
          "SF Pro Text",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        sans: [
          "SF Pro Text",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        body: ["17px", { lineHeight: "1.47059", letterSpacing: "-0.022em" }],
        label: ["21px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.01em" }],
        h1: ["56px", { lineHeight: "1.07", fontWeight: "600", letterSpacing: "-0.02em" }],
        h2: ["40px", { lineHeight: "1.1", fontWeight: "600", letterSpacing: "-0.015em" }],
        h3: ["34px", { lineHeight: "1.15", fontWeight: "600", letterSpacing: "-0.01em" }],
        h4: ["28px", { lineHeight: "1.2", fontWeight: "400", letterSpacing: "-0.01em" }],
      },
      borderRadius: {
        pill: "999px",
      },
      backgroundImage: {
        // Minimal Apple-like washes (no teal mesh)
        "grid-fade":
          "linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-main) 100%)",
        "hero-mesh": "linear-gradient(180deg, #000000 0%, #1d1d1f 100%)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        rise: "rise 0.6s ease-out both",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
