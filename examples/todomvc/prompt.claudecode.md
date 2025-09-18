## Objective
Test basic functionality of todo app.

## Test setup: tests/template.spec.ts:11

## Steps
- Use `playwright-test-planner` subagent to create a test plan for "Basic operations".
  Use seed test from `tests/seed.spec.ts` to init page. Save the test plan as `specs/basic-operations.md`.

- For each scenario in `specs/basic-operations.md`, use `playwright-test-generator`
  subagent to perform the scenario and generate the test source code into `tests/` folder.

- Use `playwright-test-healer` subagent to fix the failing tests.
