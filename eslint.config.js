// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "android/*", "ios/*"],
  },
  {
    // The API server and build scripts run in Node, not React Native.
    files: ["server/**/*.mjs", "scripts/**/*.{js,cjs}"],
    languageOptions: { globals: { Buffer: "readonly", process: "readonly", __dirname: "readonly", __filename: "readonly" } },
  },
]);
