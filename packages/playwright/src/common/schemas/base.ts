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

import { z as zod } from 'playwright-core/lib/mcpBundle';

export const positiveNumber = zod.number().int().positive({
  message: 'Must be a positive number',
});

export const nonNegativeNumber = zod.number().int().min(0, {
  message: 'Must be zero or a positive number',
});

export const workersOrPercentage = zod.union([
  positiveNumber,
  zod.string().regex(/^\d+%$/, {
    message: 'Must be a percentage like "50%"',
  }),
]);

export const filePath = zod.string();

export const regExpOrArray = zod.union([
  zod.instanceof(RegExp),
  zod.array(zod.instanceof(RegExp)),
]);

export const stringOrArray = zod.union([
  zod.string(),
  zod.array(zod.string()),
]);

export const stringOrArrayOptional = zod.union([
  zod.string(),
  zod.array(zod.string()),
  zod.undefined(),
]).transform(val => {
  if (val === undefined) return [];
  if (Array.isArray(val)) return val;
  return [val];
});
