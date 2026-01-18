import { test } from '../../fixtures';

test('should filter completed todos', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Active task', 'Completed 1', 'Completed 2'`);
  await agent.expect(`All three todos are visible`);

  await agent.perform(`Mark 'Completed 1' and 'Completed 2' as completed by clicking their checkboxes`);
  await agent.expect(`Two todos are marked as complete`);

  await agent.perform(`Click on the 'Completed' filter link`);
  await agent.expect(`The URL changes to #/completed`);
  await agent.expect(`Only 'Completed 1' and 'Completed 2' are displayed`);
  await agent.expect(`'Active task' is not visible`);
  await agent.expect(`The 'Completed' filter link is highlighted`);
});
