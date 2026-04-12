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

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  pattern?: string;
  patternError?: string;
};

const regexCache = new Map<string, RegExp>();

export function validate(value: unknown, schema: JsonSchema, path: string): string[] {
  const errors: string[] = [];

  if (schema.oneOf) {
    let bestErrors: string[] | undefined;
    for (const variant of schema.oneOf) {
      const variantErrors = validate(value, variant, path);
      if (variantErrors.length === 0)
        return [];
      // Prefer the variant with fewest errors (closest match).
      if (!bestErrors || variantErrors.length < bestErrors.length)
        bestErrors = variantErrors;
    }
    // If the best match has only top-level type mismatches, use a generic message.
    if (bestErrors!.length === 1 && bestErrors![0].startsWith(`${path}: expected `))
      return [`${path}: does not match any of the expected types`];
    return bestErrors!;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${path}: expected string, got ${typeof value}`);
      return errors;
    }
    if (schema.pattern && !cachedRegex(schema.pattern).test(value))
      errors.push(schema.patternError || `${path}: must match pattern "${schema.pattern}"`);
    return errors;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array, got ${typeof value}`);
      return errors;
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++)
        errors.push(...validate(value[i], schema.items, `${path}[${i}]`));
    }
    return errors;
  }

  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path}: expected object, got ${Array.isArray(value) ? 'array' : typeof value}`);
      return errors;
    }
    const obj = value as Record<string, unknown>;
    for (const key of schema.required || []) {
      if (obj[key] === undefined)
        errors.push(`${path}.${key}: required`);
    }
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (obj[key] !== undefined)
        errors.push(...validate(obj[key], propSchema, `${path}.${key}`));
    }
    return errors;
  }

  return errors;
}

function cachedRegex(pattern: string): RegExp {
  let regex = regexCache.get(pattern);
  if (!regex) {
    regex = new RegExp(pattern);
    regexCache.set(pattern, regex);
  }
  return regex;
}
