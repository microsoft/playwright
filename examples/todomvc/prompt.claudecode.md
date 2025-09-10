## Objective
Test basic functionality of todo app.

## Test setup: tests/template.spec.ts:11

## Steps
- Use `playwright-test-planner` subagent to create a test plan.
  Save the test plan as `specs/test-plan.md`.

- For each scenario in `specs/test-plan.md`, use `playwright-test-generator`
  subagent to perform the scenario and generate the test source code into `tests/` folder.

- Use `playwright-test-fixer` subagent to fix the failing tests.
