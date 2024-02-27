module.exports = {
  extends: "./.eslintrc.js",
  parserOptions: {
    ecmaVersion: 9,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  rules: {
    "@typescript-eslint/no-base-to-string": "error",
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": 2,
  },
  parserOptions: {
    project: "./tsconfig.json"
  },
};
