/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0ea5e9",
        "primary-dark": "#0284c7",
        "accent": "#f59e0b",
      },
    },
  },
  plugins: [],
};
