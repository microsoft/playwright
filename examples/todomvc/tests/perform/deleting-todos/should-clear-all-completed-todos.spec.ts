import { test } from '../../fixtures';

test('should clear all completed todos', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3'`);
  await agent.expect(`All three todos are visible`);

  await agent.perform(`Mark 'Task 1' and 'Task 3' as complete by clicking their checkboxes`);
  await agent.expect(`Two todos are marked as complete`);
  await agent.expect(`Counter shows '1 item left'`);
  await agent.expect(`The 'Clear completed' button appears`);

  await agent.perform(`Click the 'Clear completed' button`);
  await agent.expect(`'Task 1' and 'Task 3' are removed from the list`);
  await agent.expect(`Only 'Task 2' remains visible`);
  await agent.expect(`Counter shows '1 item left'`);
  await agent.expect(`The 'Clear completed' button disappears`);
});
