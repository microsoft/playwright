module.exports = {
  extends: ".eslintrc.js",
  rules: {
    "@typescript-eslint/no-base-to-string": "error",
  },
  parserOptions: {
    project: "./tsconfig.json"
  },
};
