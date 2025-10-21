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
import { z } from 'zod';

const annotationSchema = z.object({
  type: z.string().min(1, 'Annotation type must be a non-empty string'),
  description: z.string().optional(),
});


export function validateAnnotations(annotations: any[]) {
  return annotations.map((annotation, index) => {
    try {
      return annotationSchema.parse(annotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => issue.message).join(', ');
        throw new Error(`Invalid annotation at index ${index}: ${issues}`);
      }
      throw error;
    }
  });
}
