/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Instrument-panel palette: telemetry cyan, caution amber, orbital night.
        hull:     "#0B1220",
        panel:    "#111A2B",
        edge:     "#1E2B42",
        ink:      "#E8EDF5",
        muted:    "#8296B4",
        predicted:"#4DD8E6",
        observed: "#F2A93B",
        night:    "#1B2440",
        alarm:    "#FF6B5B",
        nominal:  "#5BD99A",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
