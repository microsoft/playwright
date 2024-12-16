const path = require('path');

module.exports = {
  extends: '../.eslintrc.js',
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "notice"],
  parserOptions: {
    ecmaVersion: 9,
    sourceType: "module",
    project: path.join(__dirname, 'tsconfig.json'),
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": 2,
    // Not strictly necessary for tests and there are some config issues with it
    "@typescript-eslint/no-unnecessary-condition": 0,
  },
};
