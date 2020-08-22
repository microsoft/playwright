/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

type GlobalInfo = { outputDir: string };
declare const before: (f: (info: GlobalInfo) => Promise<any>) => void;
declare const after: (f: (info: GlobalInfo) => Promise<any>) => void;
declare const matrix: (m: any) => void;

matrix({
  'browserName': process.env.BROWSER ? [process.env.BROWSER] : ['chromium', 'webkit', 'firefox'],
  'headless': [!!valueFromEnv('HEADLESS', true)],
  'wire': [!!process.env.PWWIRE],
  'slowMo': [valueFromEnv('SLOW_MO', 0)]
});

before(async () => {
});

after(async () => {
});

function valueFromEnv(name, defaultValue) {
  if (!(name in process.env))
    return defaultValue;
  return JSON.parse(process.env[name]);
}
