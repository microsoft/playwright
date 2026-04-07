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
import type { iso } from '../../../packages/playwright-core/lib/coreBundle';
import { iso as _iso } from '../../../packages/playwright-core/lib/coreBundle';

const { validate } = _iso;
type JsonSchema = iso.JsonSchema;

it('should validate string type', () => {
  expect(validate('hello', { type: 'string' }, '$')).toEqual([]);
  expect(validate(123, { type: 'string' }, '$')).toEqual(['$: expected string, got number']);
});

it('should validate string pattern', () => {
  expect(validate('@tag', { type: 'string', pattern: '^@' }, '$')).toEqual([]);
  expect(validate('tag', { type: 'string', pattern: '^@' }, '$')).toEqual(['$: must match pattern "^@"']);
});

it('should validate array type', () => {
  expect(validate([], { type: 'array' }, '$')).toEqual([]);
  expect(validate('not-array', { type: 'array' }, '$')).toEqual(['$: expected array, got string']);
});

it('should validate array items', () => {
  const schema: JsonSchema = { type: 'array', items: { type: 'string' } };
  expect(validate(['a', 'b'], schema, '$')).toEqual([]);
  expect(validate(['a', 1], schema, '$')).toEqual(['$[1]: expected string, got number']);
});

it('should validate object type', () => {
  expect(validate({}, { type: 'object' }, '$')).toEqual([]);
  expect(validate(null, { type: 'object' }, '$')).toEqual(['$: expected object, got object']);
  expect(validate([], { type: 'object' }, '$')).toEqual(['$: expected object, got array']);
  expect(validate('str', { type: 'object' }, '$')).toEqual(['$: expected object, got string']);
});

it('should validate required properties', () => {
  const schema: JsonSchema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
  expect(validate({ name: 'test' }, schema, '$')).toEqual([]);
  expect(validate({}, schema, '$')).toEqual(['$.name: required']);
});

it('should validate optional properties', () => {
  const schema: JsonSchema = { type: 'object', properties: { name: { type: 'string' } } };
  expect(validate({}, schema, '$')).toEqual([]);
  expect(validate({ name: 'test' }, schema, '$')).toEqual([]);
  expect(validate({ name: 123 }, schema, '$')).toEqual(['$.name: expected string, got number']);
});

it('should validate oneOf', () => {
  const schema: JsonSchema = { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] };
  expect(validate('hello', schema, '$')).toEqual([]);
  expect(validate(['a', 'b'], schema, '$')).toEqual([]);
  expect(validate(123, schema, '$')).toEqual(['$: does not match any of the expected types']);
});

it('should validate nested objects', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      annotation: {
        type: 'object',
        properties: { type: { type: 'string' } },
        required: ['type'],
      }
    }
  };
  expect(validate({ annotation: { type: 'info' } }, schema, '$')).toEqual([]);
  expect(validate({ annotation: {} }, schema, '$')).toEqual(['$.annotation.type: required']);
  expect(validate({ annotation: { type: 123 } }, schema, '$')).toEqual(['$.annotation.type: expected string, got number']);
});

it('should validate test details schema', () => {
  const testAnnotationSchema: JsonSchema = {
    type: 'object',
    properties: { type: { type: 'string' }, description: { type: 'string' } },
    required: ['type'],
  };
  const testDetailsSchema: JsonSchema = {
    type: 'object',
    properties: {
      tag: { oneOf: [{ type: 'string', pattern: '^@' }, { type: 'array', items: { type: 'string', pattern: '^@' } }] },
      annotation: { oneOf: [testAnnotationSchema, { type: 'array', items: testAnnotationSchema }] },
    },
  };

  // Valid cases.
  expect(validate({}, testDetailsSchema, '$')).toEqual([]);
  expect(validate({ tag: '@fast' }, testDetailsSchema, '$')).toEqual([]);
  expect(validate({ tag: ['@fast', '@slow'] }, testDetailsSchema, '$')).toEqual([]);
  expect(validate({ annotation: { type: 'issue' } }, testDetailsSchema, '$')).toEqual([]);
  expect(validate({ annotation: { type: 'issue', description: 'bug' } }, testDetailsSchema, '$')).toEqual([]);
  expect(validate({ annotation: [{ type: 'a' }, { type: 'b' }] }, testDetailsSchema, '$')).toEqual([]);
  expect(validate({ tag: '@fast', annotation: { type: 'issue' } }, testDetailsSchema, '$')).toEqual([]);

  // Invalid cases.
  expect(validate({ tag: 'no-at' }, testDetailsSchema, '$').length).toBeGreaterThan(0);
  expect(validate({ tag: ['@ok', 'no-at'] }, testDetailsSchema, '$').length).toBeGreaterThan(0);
  expect(validate({ annotation: 'not-object' }, testDetailsSchema, '$').length).toBeGreaterThan(0);
  expect(validate({ annotation: { description: 'missing type' } }, testDetailsSchema, '$').length).toBeGreaterThan(0);
});
