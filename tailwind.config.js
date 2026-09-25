const c = (name) => `rgb(var(--color-${name}-rgb) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: c("background"),
        foreground: c("foreground"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        secondary: { DEFAULT: c("secondary"), foreground: c("secondary-foreground") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        card: { DEFAULT: c("card"), foreground: c("card-foreground") },
        border: c("border"),
        input: c("input"),
        destructive: { DEFAULT: c("destructive"), foreground: c("destructive-foreground") },
        success: { DEFAULT: c("success"), foreground: c("success-foreground") },
        chart1: c("chart1"),
        chart2: c("chart2"),
        chart3: c("chart3"),
        chart4: c("chart4"),
        chart5: c("chart5"),
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)",
      },
      borderRadius: {
        theme: "var(--radius)",
      },
    },
  },
  plugins: [],
};
