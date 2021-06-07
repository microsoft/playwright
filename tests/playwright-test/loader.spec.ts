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

 import { test, expect } from './playwright-test-fixtures';

 test('should return the location of a syntax error', async ({ runInlineTest }) => {
   const result = await runInlineTest({
     'error.spec.js': `
       const x = {
         foo: 'bar';
       };
     `
   });
   expect(result.exitCode).toBe(1);
   expect(result.passed).toBe(0);
   expect(result.failed).toBe(0);
   expect(result.output).toContain('/error.spec.js:6');
 });
 
 test('should print an improper error', async ({ runInlineTest }) => {
   const result = await runInlineTest({
     'error.spec.js': `
       throw 123;
     `
   });
   expect(result.exitCode).toBe(1);
   expect(result.passed).toBe(0);
   expect(result.failed).toBe(0);
   expect(result.output).toContain('123');
 });
 
 
 test('should print a null error', async ({ runInlineTest }) => {
   const result = await runInlineTest({
     'error.spec.js': `
       throw null;
     `
   });
   expect(result.exitCode).toBe(1);
   expect(result.passed).toBe(0);
   expect(result.failed).toBe(0);
   expect(result.output).toContain('null');
 });
 
 test('should return the location of a syntax error in typescript', async ({ runInlineTest }) => {
   const result = await runInlineTest({
     'error.spec.ts': `
       const x = {
         foo: 'bar';
       };
     `
   }, {}, {
     FORCE_COLOR: '0'
   });
   expect(result.exitCode).toBe(1);
   expect(result.passed).toBe(0);
   expect(result.failed).toBe(0);
   expect(result.output).toContain('/error.spec.ts');
   expect(result.output).toContain('\'bar\';');
 });
 