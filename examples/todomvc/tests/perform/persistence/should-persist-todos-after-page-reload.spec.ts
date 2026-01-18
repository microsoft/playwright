import { test } from '../../fixtures';

test('should persist todos after page reload', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Persistent 1', 'Persistent 2', 'Persistent 3'`);
  await agent.expect(`All three todos appear in the list`);

  await agent.perform(`Mark 'Persistent 2' as completed by clicking its checkbox`);
  await agent.expect(`'Persistent 2' is marked as complete`);

  await agent.perform(`Reload the page`);
  await agent.expect(`All three todos are still present after reload`);
  await agent.expect(`'Persistent 2' is still marked as complete`);
  await agent.expect(`The counter shows '2 items left'`);
});
