// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
  },
  {
    // Pin react-hooks rules explicitly so a future preset change can't
    // silently drop them. rules-of-hooks catches the "hook after early
    // return" bug class that crashes screens at runtime via the
    // ErrorBoundary (see Task #103/#104). exhaustive-deps stays at "warn"
    // to match the upstream Expo preset.
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
]);
