/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import notice from 'eslint-plugin-notice';
import path from 'path';
import { fileURLToPath } from 'url';
import stylistic from '@stylistic/eslint-plugin';
import importRules from 'eslint-plugin-import';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const plugins = {
  '@stylistic': stylistic,
  '@typescript-eslint': typescriptEslint,
  notice,
  import: importRules,
};

const ignores = [
  '.github/',
  '*.js',
  '**/.cache/',
  '**/*.d.ts',
  'index.d.ts',
  'node_modules/',
  'output/',
  'packages/*/lib/',
  'packages/html-reporter/**',
  'packages/playwright-core/src/generated/*',
  'packages/playwright-core/src/third_party/',
  'packages/playwright-core/types/*',
  'packages/playwright-ct-core/src/generated/*',
  'packages/recorder/**',
  'packages/trace-viewer/**',
  'packages/web/**',
  'test-results/',
  'tests/assets/',
  'tests/components/',
  'tests/installation/fixture-scripts/',
  'tests/third_party/',
  'utils/',
];

export const baseRules = {
  '@typescript-eslint/no-unused-vars': [2, { args: 'none', caughtErrors: 'none' }],

  /**
   * Enforced rules
   */
  // syntax preferences
  'object-curly-spacing': ['error', 'always'],
  'quotes': [2, 'single', {
    'avoidEscape': true,
    'allowTemplateLiterals': true
  }],
  'jsx-quotes': [2, 'prefer-single'],
  'no-extra-semi': 2,
  '@stylistic/semi': [2],
  'comma-style': [2, 'last'],
  'wrap-iife': [2, 'inside'],
  'spaced-comment': [2, 'always', {
    'markers': ['*']
  }],
  'eqeqeq': [2],
  'accessor-pairs': [2, {
    'getWithoutSet': false,
    'setWithoutGet': false
  }],
  'brace-style': [2, '1tbs', { 'allowSingleLine': true }],
  'curly': [2, 'multi-or-nest', 'consistent'],
  'new-parens': 2,
  'arrow-parens': [2, 'as-needed'],
  'prefer-const': 2,
  'quote-props': [2, 'consistent'],
  'nonblock-statement-body-position': [2, 'below'],

  // anti-patterns
  'no-var': 2,
  'no-with': 2,
  'no-multi-str': 2,
  'no-caller': 2,
  'no-implied-eval': 2,
  'no-labels': 2,
  'no-new-object': 2,
  'no-octal-escape': 2,
  'no-self-compare': 2,
  'no-shadow-restricted-names': 2,
  'no-cond-assign': 2,
  'no-debugger': 2,
  'no-dupe-keys': 2,
  'no-duplicate-case': 2,
  'no-empty-character-class': 2,
  'no-unreachable': 2,
  'no-unsafe-negation': 2,
  'radix': 2,
  'valid-typeof': 2,
  'no-implicit-globals': [2],
  'no-unused-expressions': [2, { 'allowShortCircuit': true, 'allowTernary': true, 'allowTaggedTemplates': true }],
  'no-proto': 2,

  // es2015 features
  'require-yield': 2,
  'template-curly-spacing': [2, 'never'],

  // spacing details
  'space-infix-ops': 2,
  'space-in-parens': [2, 'never'],
  'array-bracket-spacing': [2, 'never'],
  'comma-spacing': [2, { 'before': false, 'after': true }],
  'keyword-spacing': [2, 'always'],
  'space-before-function-paren': [2, {
    'anonymous': 'never',
    'named': 'never',
    'asyncArrow': 'always'
  }],
  'no-whitespace-before-property': 2,
  'keyword-spacing': [2, {
    'overrides': {
      'if': { 'after': true },
      'else': { 'after': true },
      'for': { 'after': true },
      'while': { 'after': true },
      'do': { 'after': true },
      'switch': { 'after': true },
      'return': { 'after': true }
    }
  }],
  'arrow-spacing': [2, {
    'after': true,
    'before': true
  }],
  '@stylistic/func-call-spacing': 2,
  '@stylistic/type-annotation-spacing': 2,

  // file whitespace
  'no-multiple-empty-lines': [2, { 'max': 2, 'maxEOF': 0 }],
  'no-mixed-spaces-and-tabs': 2,
  'no-trailing-spaces': 2,
  'linebreak-style': [process.platform === 'win32' ? 0 : 2, 'unix'],
  'indent': [2, 2, { 'SwitchCase': 1, 'CallExpression': { 'arguments': 2 }, 'MemberExpression': 2 }],
  'key-spacing': [2, {
    'beforeColon': false
  }],
  'eol-last': 2,

  // copyright
  'notice/notice': [2, {
    'mustMatch': 'Copyright',
    'templateFile': path.join(__dirname, 'utils', 'copyright.js'),
  }],

  // react
  'react/react-in-jsx-scope': 0
};

const noFloatingPromisesRules = {
  '@typescript-eslint/no-floating-promises': 'error',
};

const noBooleanCompareRules = {
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 2,
};

const noRestrictedGlobalsRules = {
  'no-restricted-globals': [
    'error',
    { 'name': 'window' },
    { 'name': 'document' },
    { 'name': 'globalThis' },
  ],
};

const importOrderRules = {
  'import/order': [2, {
    'groups': ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'type'],
    'newlines-between': 'always',
  }],
  'import/consistent-type-specifier-style': [2, 'prefer-top-level']
};

const languageOptions = {
  parser: tsParser,
  ecmaVersion: 9,
  sourceType: 'module',
};

const languageOptionsWithTsConfig = {
  parser: tsParser,
  ecmaVersion: 9,
  sourceType: 'module',
  parserOptions: {
    project: path.join(__dirname, 'tsconfig.json'),
  },
};

export default [{
  ignores,
}, {
  files: ['**/*.ts'],
  plugins,
  languageOptions,
  rules: baseRules,
}, {
  files: ['packages/**/*.ts'],
  languageOptions: languageOptionsWithTsConfig,
  rules: {
    'no-console': 2,
    'no-restricted-properties': [2, {
      'object': 'process',
      'property': 'exit',
      'message': 'Please use gracefullyProcessExitDoNotHang function to exit the process.',
    }],
  }
}, {
  files: [
    'packages/**/*.ts',
  ],
  rules: {
    ...importOrderRules
  },
}, {
  files: ['packages/playwright/**/*.ts'],
  rules: {
    ...noFloatingPromisesRules,
  }
}, {
  files: ['packages/playwright/src/reporters/**/*.ts'],
  languageOptions: languageOptionsWithTsConfig,
  rules: {
    'no-console': 'off'
  }
}, {
  files: ['packages/playwright-core/src/server/injected/**/*.ts'],
  languageOptions: languageOptionsWithTsConfig,
  rules: {
    ...noRestrictedGlobalsRules,
    ...noFloatingPromisesRules,
    ...noBooleanCompareRules,
  }
}, {
  files: ['tests/**/*.spec.js', 'tests/**/*.ts'],
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 9,
    sourceType: 'module',
    parserOptions: {
      project: path.join(__dirname, 'tests', 'tsconfig.json'),
    },
  },
  rules: {
    ...noFloatingPromisesRules,
  }
}];
