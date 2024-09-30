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

export function getFromENV(name: string): string | undefined {
  let value = process.env[name];
  value = value === undefined ? process.env[`npm_config_${name.toLowerCase()}`] : value;
  value = value === undefined ? process.env[`npm_package_config_${name.toLowerCase()}`] : value;
  return value;
}

export function getAsBooleanFromENV(name: string, defaultValue?: boolean | undefined): boolean {
  const value = getFromENV(name);
  if (value === 'false' || value === '0')
    return false;
  if (value)
    return true;
  return !!defaultValue;
}

export function getPackageManager() {
  const env = process.env.npm_config_user_agent || '';
  if (env.includes('yarn'))
    return 'yarn';
  if (env.includes('pnpm'))
    return 'pnpm';
  return 'npm';
}

export function getPackageManagerExecCommand() {
  const packageManager = getPackageManager();
  if (packageManager === 'yarn')
    return 'yarn';
  if (packageManager === 'pnpm')
    return 'pnpm exec';
  return 'npx';
}

export function getParsedFromEnv(key: string): Array<{name: string, value: string}> {
  const envValue = getFromENV(key);
  if (envValue) {
    const commaSplittedValuesInEnv = [...new Set(envValue.split(','))].map(prop => {
      let property = prop.split('=');
      if (property.length === 2 && property[0] && property[1])
        return {name: property[0].trim(), value: property[1].trim()};
    }).filter(item => !!item)
    const uniqueItems = [];
    const mapWithUniqueName = new Map();
    for (const value of commaSplittedValuesInEnv) {
      const key = Object.values(value)[0];
      if (!mapWithUniqueName.has(key)) {
        mapWithUniqueName.set(key, true);
        uniqueItems.push(value);
      }
    }
    return uniqueItems;
  }
  return [];
}


