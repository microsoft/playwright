import { test } from '../../fixtures';

test('should complete multiple todos', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos: 'Buy milk', 'Walk dog', 'Finish report'`);
  await agent.expect(`All three todos are visible`);
  await agent.expect(`Counter shows '3 items left'`);

  await agent.perform(`Complete the first todo by clicking its checkbox`);
  await agent.expect(`First todo is marked as complete`);
  await agent.expect(`Counter shows '2 items left'`);

  await agent.perform(`Complete the third todo by clicking its checkbox`);
  await agent.expect(`Third todo is marked as complete`);
  await agent.expect(`Counter shows '1 item left'`);
  await agent.expect(`The 'Clear completed' button appears`);
});
