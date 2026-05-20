import nextConfig from "eslint-config-next";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // Global ignores must be in their own config object with only the `ignores` key
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "next-env.d.ts",
      "apps/web/.next/**"
    ]
  },
  ...nextConfig,
  eslintConfigPrettier,
  {
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "import/no-anonymous-default-export": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-assign-module-variable": "off"
    }
  }
];
