
# Produce test coverage

Parameters:
- Task: the task to perform
- Seed file (optional): the seed file to use, defaults to tests/seed.spec.ts
- Test plan file (optional): the test plan file to write, under specs/ folder.

1. Call #planner subagent with prompt:

<plan>
  <task><!-- the task --></task>
  <seed-file><!-- seed file param --></seed-file>
  <plan-file><!-- test plan file --></plan-file>
</plan>

2. For each test case from the test plan file (1.1, 1.2, ...), Call #generator subagent with prompt:

<generate>
  <test-file><!-- Name of the file to save the test into, should be unique for test --></test-file>
  <test-suite><!-- Name of the top level test spec w/o ordinal--></test-suite>
  <test-name><!--Name of the test case without the ordinal --></test-name>
  <seed-file><!-- Seed file from test plan --></seed-file>
  <body><!-- Test case content including steps and expectations --></body>
</generate>

3. Call #healer subagent with prompt:

<heal>Run all tests and fix the failing ones one after another.</heal>
