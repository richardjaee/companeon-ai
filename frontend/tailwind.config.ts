import type { Config } from "tailwindcss";
import { tokens } from "./src/styles/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: {
        sans: [tokens.fonts.primary],
        brand: [tokens.fonts.brand],
      },
      spacing: tokens.spacing,
      borderRadius: tokens.borderRadius,
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px', 
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
