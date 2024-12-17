const path = require('path');

module.exports = {
  extends: '../.eslintrc.js',
  parserOptions: {
    project: path.join(__dirname, 'tsconfig.json'),
  },
  overrides: [
    {
      files: ['*.ts', './playwright/*'],
      // Disable Typescript specific rules, which requires a special config
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
    },
  ],
};
