const path = require('path');

module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "notice"],
  parserOptions: {
    ecmaVersion: 9,
    sourceType: "module",
    project: path.join(__dirname, '../../../../../tsconfig.json'),
  },
  rules: {
    "no-restricted-globals": [
        "error",
        { "name": "window" },
        { "name": "document" },
        { "name": "globalThis" },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": 2,
  },
};
