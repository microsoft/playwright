module.exports = {
  "extends": "../.eslintrc.js",
  /**
   * ESLint rules
   *
   * All available rules: http://eslint.org/docs/rules/
   *
   * Rules take the following form:
   *   "rule-name", [severity, { opts }]
   * Severity: 2 == error, 1 == warning, 0 == off.
   */
  "rules": {
    "no-console": 2,
    "no-debugger": 2,
    "no-restricted-properties": [2, {
      "object": "process",
      "property": "exit",
      "message": "Please use gracefullyProcessExitDoNotHang function to exit the process.",
    }],
  }
};
