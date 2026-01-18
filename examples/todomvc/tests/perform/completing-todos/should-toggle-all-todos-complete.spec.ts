import { test } from '../../fixtures';

test('should toggle all todos complete', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3'`);
  await agent.expect(`All three todos are visible and active`);
  await agent.expect(`Counter shows '3 items left'`);

  await agent.perform(`Click the 'Mark all as complete' checkbox`);
  await agent.expect(`All three todos are marked as complete`);
  await agent.expect(`All checkboxes are checked`);
  await agent.expect(`Counter shows '0 items left'`);
  await agent.expect(`The 'Clear completed' button appears`);
});
