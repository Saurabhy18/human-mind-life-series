// Tailwind CSS v4 is processed through its official PostCSS plugin.
// Turbopack (and webpack) pick this up automatically, so no custom
// per-file CSS loader rule is needed in next.config.ts.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
