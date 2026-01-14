/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { test, expect } from './playwright-test-fixtures';
import type { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

test('sourcemaps', async ({ runInlineTest }) => {
  class LocationReporter implements Reporter {
    onTestEnd(test: TestCase, result: TestResult): void {
      console.log(`%%${test.title} ${test.location.file}:${test.location.line}:${test.location.column}`);
      function visit(step: TestStep, indent: string) {
        if (step.location)
          console.log(`%%${indent}${step.title} ${step.location.file}:${step.location.line}:${step.location.column}`);
        for (const child of step.steps)
          visit(child, indent + '> ');
      }
      for (const step of result.steps)
        visit(step, '> ');
    }
  }
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter.toString()}`,
    'seed.spec.md': `
## Seed

### seed test

- Navigate to 'https://demo.playwright.dev/todomvc'
  \`\`\`ts
  await page.goto('https://demo.playwright.dev/todomvc');
  \`\`\`

- expect: page title contains "TodoMVC"

- expect: The input field 'What needs to be done?' is visible
    `,
    'seed.spec.md-cache.json': JSON.stringify({
      'page title contains "TodoMVC"': {
        'actions': []
      },
      "The input field 'What needs to be done?' is visible": {
        'actions': [
          {
            'method': 'expectVisible',
            'selector': 'internal:role=textbox[name="What needs to be done?"i]',
            'code': "await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();"
          }
        ]
      }
    }),
    'should-add-single-todo.spec.md': `
## Adding Todos

- seed: ./seed.spec.md

### should add single todo

- tag: @regression
- annotation: issue=123

- group: Add the todo
  - Type 'Buy groceries' into the input field
  - expect: The text appears in the input field
- Press Enter to submit the todo
- group: Verify todo is added to the list
  - expect: The new todo 'Buy groceries' appears in the todo list
  - expect: The input field is cleared
  - expect: The todo counter shows '1 item left'
    `,
    'should-add-single-todo.spec.md-cache.json': JSON.stringify({
      'page title contains "TodoMVC"': {
        'actions': []
      },
      'Press Enter to submit the todo': {
        'actions': [
          {
            'method': 'pressKey',
            'key': 'Enter',
            'code': "await page.keyboard.press('Enter');"
          }
        ]
      },
      "The input field 'What needs to be done?' is visible": {
        'actions': [
          {
            'method': 'expectVisible',
            'selector': 'internal:role=textbox[name="What needs to be done?"i]',
            'code': "await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();"
          }
        ]
      },
      'The input field is cleared': {
        'actions': [
          {
            'method': 'expectValue',
            'selector': 'internal:role=textbox[name="What needs to be done?"i]',
            'type': 'textbox',
            'value': '',
            'code': "await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('');"
          }
        ]
      },
      "The new todo 'Buy groceries' appears in the todo list": {
        'actions': [
          {
            'method': 'expectVisible',
            'selector': 'internal:text="Buy groceries"i',
            'code': "await expect(page.getByText('Buy groceries')).toBeVisible();"
          }
        ]
      },
      'The text appears in the input field': {
        'actions': [
          {
            'method': 'expectValue',
            'selector': 'internal:role=textbox[name="What needs to be done?"i]',
            'type': 'textbox',
            'value': 'Buy groceries',
            'code': "await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('Buy groceries');"
          }
        ]
      },
      "The todo counter shows '1 item left'": {
        'actions': [
          {
            'method': 'expectVisible',
            'selector': 'internal:text="1 item left"i',
            'code': "await expect(page.getByText('1 item left')).toBeVisible();"
          }
        ]
      },
      "Type 'Buy groceries' into the input field": {
        'actions': [
          {
            'method': 'fill',
            'selector': 'internal:role=textbox[name="What needs to be done?"i]',
            'text': 'Buy groceries',
            'code': "await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');"
          }
        ]
      }
    }),
  }, { reporter: './location-reporter.js', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    `seed test ${test.info().outputPath('seed.spec.md')}:4:2`,
    `> Navigate to 'https://demo.playwright.dev/todomvc' ${test.info().outputPath('seed.spec.md')}:6:2`,
    `> > Navigate to "/todomvc" ${test.info().outputPath('seed.spec.md')}:8:4`,
    `> Expect "page title contains "TodoMVC"" ${test.info().outputPath('seed.spec.md')}:11:2`,
    `> Expect "The input field 'What needs to be done?' is visible" ${test.info().outputPath('seed.spec.md')}:13:2`,
    `should add single todo ${test.info().outputPath('should-add-single-todo.spec.md')}:6:2`,
    `> Navigate to 'https://demo.playwright.dev/todomvc' ${test.info().outputPath('seed.spec.md')}:6:2`,
    `> > Navigate to "/todomvc" ${test.info().outputPath('seed.spec.md')}:8:4`,
    `> Expect "page title contains "TodoMVC"" ${test.info().outputPath('seed.spec.md')}:11:2`,
    `> Expect "The input field 'What needs to be done?' is visible" ${test.info().outputPath('seed.spec.md')}:13:2`,
    `> Add the todo ${test.info().outputPath('should-add-single-todo.spec.md')}:11:2`,
    `> > Perform "Type 'Buy groceries' into the input field" ${test.info().outputPath('should-add-single-todo.spec.md')}:12:4`,
    `> > Expect "The text appears in the input field" ${test.info().outputPath('should-add-single-todo.spec.md')}:13:4`,
    `> Perform "Press Enter to submit the todo" ${test.info().outputPath('should-add-single-todo.spec.md')}:14:2`,
    `> Verify todo is added to the list ${test.info().outputPath('should-add-single-todo.spec.md')}:15:2`,
    `> > Expect "The new todo 'Buy groceries' appears in the todo list" ${test.info().outputPath('should-add-single-todo.spec.md')}:16:4`,
    `> > Expect "The input field is cleared" ${test.info().outputPath('should-add-single-todo.spec.md')}:17:4`,
    `> > Expect "The todo counter shows '1 item left'" ${test.info().outputPath('should-add-single-todo.spec.md')}:18:4`,
  ]);
});
