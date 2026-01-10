import { test } from '../../fixtures';

test('should delete single todo', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Task to delete'`);
  await agent.expect(`The todo appears in the list`);
  await agent.expect(`Counter shows '1 item left'`);

  await agent.perform(`Hover over the todo item`);
  await agent.expect(`A delete button (x) appears on the right side of the todo`);

  await agent.perform(`Click the delete button`);
  await agent.expect(`The todo is removed from the list`);
  await agent.expect(`The list is empty`);
  await agent.expect(`The footer is hidden or shows '0 items left'`);
});
