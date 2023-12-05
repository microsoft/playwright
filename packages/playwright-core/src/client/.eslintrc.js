module.exports = {
  extends: '../../../.eslintrc.js',
  plugins: ['internal-playwright'],
  rules: {
    'internal-playwright/await-promise-in-class-returns': 'error',
  },
};
