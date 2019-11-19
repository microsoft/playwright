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
        "no-console": [2, { "allow": ["warn", "error", "assert", "timeStamp", "time", "timeEnd"] }],
        "no-debugger": 0,
    }
};
