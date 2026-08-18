/** @type {import('tailwindcss').Config} */

// Instrument-panel palette. Two rules govern it, and both are checkable:
//
//   1. Series hues (predicted/observed/residual) encode IDENTITY only. They are
//      never used to say "this is bad" — that is the status ramp's job.
//   2. Every series hue sits inside the OKLCH dark-mode lightness band
//      (L 0.48–0.67), clears the chroma floor, and clears CVD separation against
//      its neighbour on the #111A2B panel surface. The starter palette did not:
//      #4DD8E6 / #F2A93B measured L 0.81 / 0.79, above the band. The values below
//      are re-stepped on the same hues and validated.
//
// Status colours are text-legible (>= 4.5:1) on both panel and hull, because they
// always ship as colour + label, never colour alone.

module.exports = {
  // lib/ is in here because the status-ramp class names live in lib/format.ts.
  // Leave it out and `bg-serious` / `text-serious` are purged, and every severity
  // meter silently renders as bare track.
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── surfaces ──────────────────────────────────────────────
        hull: "#0B1220", // page
        panel: "#111A2B", // card
        raised: "#16223A", // hover / inset
        edge: "#1E2B42", // hairline border
        grid: "#1E2B42", // chart gridlines — one step off surface
        night: "#182135", // eclipse band, sits *behind* the curves

        // ── text ──────────────────────────────────────────────────
        ink: "#E8EDF5", // primary
        dim: "#B3C1D6", // secondary
        muted: "#8296B4", // tertiary / axis

        // ── series (identity) ─────────────────────────────────────
        predicted: "#10A6AD",
        observed: "#CB8315",
        residual: "#8E9BE8",

        // ── status (state) — reserved, never a series ─────────────
        good: "#5BD99A",
        caution: "#E8B44A",
        serious: "#F0854A",
        critical: "#FF7A6B",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      keyframes: {
        // A slow pulse for the live-link LED. Nothing else animates.
        breathe: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        breathe: "breathe 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
