import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    files: ["src/features/link/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
];

export default config;
