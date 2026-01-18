import { test } from '../../fixtures';

test('should complete single todo', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Buy groceries'`);
  await agent.expect(`The todo appears as active`);
  await agent.expect(`Counter shows '1 item left'`);

  await agent.perform(`Click the checkbox next to the todo`);
  await agent.expect(`The checkbox is checked`);
  await agent.expect(`Counter shows '0 items left'`);
  await agent.expect(`The 'Clear completed' button appears in the footer`);
});
