import { test } from '../../fixtures';

test('should toggle all todos incomplete', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3' and mark all as complete using the toggle all checkbox`);
  await agent.expect(`All todos are marked as complete`);
  await agent.expect(`Counter shows '0 items left'`);

  await agent.perform(`Click the 'Mark all as complete' checkbox again`);
  await agent.expect(`All todos are marked as active`);
  await agent.expect(`All checkboxes are unchecked`);
  await agent.expect(`Counter shows '3 items left'`);
  await agent.expect(`The 'Clear completed' button disappears`);
});
