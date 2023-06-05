const path = require('path');

module.exports = {
  extends: '../.eslintrc.js',
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "notice"],
  parserOptions: {
    ecmaVersion: 9,
    sourceType: "module",
    project: path.join(__dirname, '..', '..', 'tsconfig.json'),
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
  },
};
