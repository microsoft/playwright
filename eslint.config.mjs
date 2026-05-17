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

// Bulk linting runs through oxlint (see .oxlintrc.json). ESLint only owns the
// in-repo `progress` plugin, which needs the TypeScript program for type-aware
// analysis — something oxlint's JS-plugin API does not currently expose.

import path from "path";
import { fileURLToPath } from "url";
import tsParser from "@typescript-eslint/parser";
import progressPlugin from "./utils/eslint-plugin-progress/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const languageOptionsWithTsConfig = {
  parser: tsParser,
  ecmaVersion: 9,
  sourceType: "module",
  parserOptions: {
    project: path.join(__dirname, "tsconfig.json"),
  },
};

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    ignores: [
      ".github/",
      "*.js",
      "**/.cache/",
      "**/*.d.ts",
      "node_modules/",
      "output/",
      "**/playwright-report/",
      "examples",
      "packages/*/lib/",
      "packages/playwright-core/src/generated/*",
      "packages/playwright-core/src/third_party/",
      "packages/playwright-ct-core/src/generated/*",
      "packages/playwright/bundles/expect/third_party/",
      "test-results/",
      "tests/assets/",
      "tests/components/",
      "tests/installation/fixture-scripts/",
      "tests/third_party/",
      "utils/",
    ],
  },
  {
    files: [
      "packages/playwright-core/src/server/**/*.ts",
      "packages/utils/**/*.ts",
    ],
    plugins: {
      progress: progressPlugin,
    },
    languageOptions: languageOptionsWithTsConfig,
    rules: {
      "progress/await-must-use-progress": "error",
    },
  },
];
