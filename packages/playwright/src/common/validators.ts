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

import { zod } from 'playwright-core/lib/utilsBundle';

import type { TestAnnotation, TestDetailsAnnotation } from '../../types/test';
import type { Location } from '../../types/testReporter';
import type { ZodError } from 'zod';

const testAnnotationSchema = zod.object({
  type: zod.string(),
  description: zod.string().optional(),
});

const testDetailsSchema = zod.object({
  tag: zod.union([
    zod.string().optional(),
    zod.array(zod.string())
  ]).transform(val => Array.isArray(val) ? val : val !== undefined ? [val] : []).refine(val => val.every(v => v.startsWith('@')), {
    message: "Tag must start with '@'"
  }),
  annotation: zod.union([
    testAnnotationSchema,
    zod.array(testAnnotationSchema).optional()
  ]).transform(val => Array.isArray(val) ? val : val !== undefined ? [val] : []),
});

export function validateTestAnnotation(annotation: unknown): TestAnnotation {
  try {
    return testAnnotationSchema.parse(annotation);
  } catch (error) {
    throwZodError(error);
  }
}

type ValidTestDetails = {
  tags: string[];
  annotations: (TestDetailsAnnotation & { location: Location })[];
  location: Location;
};

export function validateTestDetails(details: unknown, location: Location): ValidTestDetails {
  try {
    const parsedDetails = testDetailsSchema.parse(details);
    return {
      annotations: parsedDetails.annotation.map(a => ({ ...a, location })),
      tags: parsedDetails.tag,
      location,
    };
  } catch (error) {
    throwZodError(error);
  }
}

function throwZodError(error: any): never {
  throw new Error((error as ZodError).issues.map(i => i.message).join('\n'));
}
