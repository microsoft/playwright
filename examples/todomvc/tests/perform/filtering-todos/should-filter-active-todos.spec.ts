import { test } from '../../fixtures';

test('should filter active todos', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Active 1', 'Active 2', 'Will complete'`);
  await agent.expect(`All three todos are visible`);

  await agent.perform(`Mark 'Will complete' as completed by clicking its checkbox`);
  await agent.expect(`One todo is marked as complete`);
  await agent.expect(`Counter shows '2 items left'`);

  await agent.perform(`Click on the 'Active' filter link`);
  await agent.expect(`The URL changes to #/active`);
  await agent.expect(`Only 'Active 1' and 'Active 2' are displayed`);
  await agent.expect(`'Will complete' is not visible`);
  await agent.expect(`The 'Active' filter link is highlighted`);
});
