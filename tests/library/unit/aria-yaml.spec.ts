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

import { test as it, expect } from '@playwright/test';
import { iso } from '../../../packages/playwright-core/lib/coreBundle';
import { yaml } from '../../../packages/playwright-core/lib/utilsBundle';

function roundtripValue(text: string): string | undefined {
  const snapshot = `- textbox "field": ${iso.yamlEscapeValueIfNeeded(text)}\n`;
  const { fragment, errors } = iso.parseAriaSnapshot(yaml, snapshot);
  if (errors.length)
    return undefined;
  return (fragment as any).children?.[0]?.text?.raw;
}

it('should quote YAML special scalars in aria snapshot values', () => {
  for (const text of ['~', '.inf', '.Inf', '.INF', '+.inf', '.nan', '.NaN', '.NAN', 'null', 'true', '.5'])
    expect(roundtripValue(text), text).toBe(text);
});
