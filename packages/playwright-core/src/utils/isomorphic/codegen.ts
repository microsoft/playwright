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

import type * as har from '@trace/har';

export function generatePlaywrightRequestCall(request: har.Request, body: string | undefined): string {
  const method = request.method;
  const headers = request.headers.map(header => {
    const name = JSON.stringify(header.name);
    const value = JSON.stringify(header.value);
    return `    ${name}: ${value}`;
  }).join(',\n');

  const url = new URL(request.url);
  const urlParam = `${url.origin}${url.pathname}`;
  let result = `await page.request.${method}(${JSON.stringify(urlParam)}, {\n`;
  result += `  headers: {\n${headers}\n  },\n`;
  result += `);`;
  return result;
}
