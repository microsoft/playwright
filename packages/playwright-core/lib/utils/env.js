"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAsBooleanFromENV = getAsBooleanFromENV;
exports.getFromENV = getFromENV;
exports.getPackageManager = getPackageManager;
exports.getPackageManagerExecCommand = getPackageManagerExecCommand;
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

function getFromENV(name) {
  let value = process.env[name];
  value = value === undefined ? process.env[`npm_config_${name.toLowerCase()}`] : value;
  value = value === undefined ? process.env[`npm_package_config_${name.toLowerCase()}`] : value;
  return value;
}
function getAsBooleanFromENV(name, defaultValue) {
  const value = getFromENV(name);
  if (value === 'false' || value === '0') return false;
  if (value) return true;
  return !!defaultValue;
}
function getPackageManager() {
  const env = process.env.npm_config_user_agent || '';
  if (env.includes('yarn')) return 'yarn';
  if (env.includes('pnpm')) return 'pnpm';
  return 'npm';
}
function getPackageManagerExecCommand() {
  const packageManager = getPackageManager();
  if (packageManager === 'yarn') return 'yarn';
  if (packageManager === 'pnpm') return 'pnpm exec';
  return 'npx';
}