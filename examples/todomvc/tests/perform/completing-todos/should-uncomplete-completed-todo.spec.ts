import { test } from '../../fixtures';

test('should uncomplete completed todo', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Buy groceries' and mark it as complete by clicking its checkbox`);
  await agent.expect(`The todo is marked as complete`);
  await agent.expect(`Counter shows '0 items left'`);

  await agent.perform(`Click the checkbox again to uncomplete it`);
  await agent.expect(`The checkbox is unchecked`);
  await agent.expect(`Counter shows '1 item left'`);
  await agent.expect(`The 'Clear completed' button disappears`);
});
