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

import { validate } from 'playwright-core/lib/utils';

import type { TestDetailsAnnotation } from '../../types/test';
import type { Location } from '../../types/testReporter';
import type { JsonSchema } from 'playwright-core/lib/utils';

const testAnnotationSchema: JsonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['type'],
};

const testDetailsSchema: JsonSchema = {
  type: 'object',
  properties: {
    tag: {
      oneOf: [
        { type: 'string', pattern: '^@', patternError: "Tag must start with '@'" },
        { type: 'array', items: { type: 'string', pattern: '^@', patternError: "Tag must start with '@'" } },
      ]
    },
    annotation: {
      oneOf: [
        testAnnotationSchema,
        { type: 'array', items: testAnnotationSchema },
      ]
    },
  },
};

type ValidTestDetails = {
  tags: string[];
  annotations: (TestDetailsAnnotation & { location: Location })[];
  location: Location;
};

export function validateTestDetails(details: unknown, location: Location): ValidTestDetails {
  const errors = validate(details, testDetailsSchema, 'details');
  if (errors.length)
    throw new Error(errors.join('\n'));

  const obj = details as Record<string, unknown>;
  const tag = obj.tag;
  const tags: string[] = tag === undefined ? [] : typeof tag === 'string' ? [tag] : tag as string[];

  const annotation = obj.annotation;
  const annotations: TestDetailsAnnotation[] = annotation === undefined ? [] : Array.isArray(annotation) ? annotation : [annotation as TestDetailsAnnotation];

  return {
    annotations: annotations.map(a => ({ ...a, location })),
    tags,
    location,
  };
}
