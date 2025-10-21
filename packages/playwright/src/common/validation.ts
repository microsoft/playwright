/**
 * Copyright (c) Microsoft Corporation.
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

import { z } from 'zod';

export const annotationSchema = z.object({
  type: z.string().min(1, 'Annotation type must be a non-empty string'),
  description: z.string().optional(),
});

const tagSchema = z.string().regex(/^@/, 'Tag must start with "@"');

export const testDetailsSchema = z.object({
  annotation: annotationSchema.or(annotationSchema.array()).optional(),
  tag: tagSchema.or(tagSchema.array()).optional(),
}).strict();

export type Annotation = z.infer<typeof annotationSchema>;
export type TestDetailsValidated = z.infer<typeof testDetailsSchema>;
