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

import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import notice from 'eslint-plugin-notice';
import path from 'path';
import { fileURLToPath } from 'url';
import stylistic from '@stylistic/eslint-plugin';
import { baseRules } from './eslint.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

const baseConfig = fixupConfigRules(compat.extends('plugin:react/recommended', 'plugin:react-hooks/recommended'));

const plugins = {
  '@stylistic': stylistic,
  '@typescript-eslint': typescriptEslint,
  notice,
};

const ignores = [
  '.github/',
  '*.js',
  '**/.cache/',
  '**/*.d.ts',
  '**/dist/**',
  'index.d.ts',
  'node_modules/',
  'output/',
  'packages/*/lib/',
  'test-results/',
  'tests/',
  'utils/',
];

export default [
  { ignores },
  { 
    plugins,
    settings: {
      react: { version: 'detect' },
    }
  },
  ...baseConfig,
  packageSection('html-reporter'),
  packageSection('recorder'),
  packageSection('trace-viewer'),
];

function packageSection(packageName) {
  return {
    files: [
      `packages/${packageName}/src/**/*.ts`,
      `packages/${packageName}/src/**/*.tsx`,
      `packages/web/src/**/*.ts`,
      `packages/web/src/**/*.tsx`,
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 9,
      sourceType: 'module',
      parserOptions: {
        project: path.join(__dirname, 'packages', packageName, 'tsconfig.json'),
      },
    },
    rules: {
      ...baseRules,
      'no-console': 2,
    }
  };
}
