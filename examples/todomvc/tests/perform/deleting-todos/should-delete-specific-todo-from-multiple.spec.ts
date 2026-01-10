import { test } from '../../fixtures';

test('should delete specific todo from multiple', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3'`);
  await agent.expect(`All three todos appear in the list`);
  await agent.expect(`Counter shows '3 items left'`);

  await agent.perform(`Hover over 'Task 2' and click its delete button`);
  await agent.expect(`'Task 2' is removed from the list`);
  await agent.expect(`'Task 1' and 'Task 3' remain visible`);
  await agent.expect(`Counter shows '2 items left'`);
});
