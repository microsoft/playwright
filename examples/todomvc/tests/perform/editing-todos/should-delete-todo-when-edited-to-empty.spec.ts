import { test } from '../../fixtures';

test('should delete todo when edited to empty', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Temporary task'`);
  await agent.expect(`The todo appears in the list`);
  await agent.expect(`Counter shows '1 item left'`);

  await agent.perform(`Double-click on the todo to enter edit mode`);
  await agent.expect(`Edit textbox appears`);

  await agent.perform(`Clear all the text and press Enter`);
  await agent.expect(`The todo is deleted from the list`);
  await agent.expect(`The list is empty`);
  await agent.expect(`Counter shows '0 items left' or the footer is hidden`);
});
