import { test } from '../../fixtures';

test('should edit todo by double clicking', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Buy milk'`);
  await agent.expect(`The todo appears in the list`);

  await agent.perform(`Double-click on the todo text`);
  await agent.expect(`The todo enters edit mode`);
  await agent.expect(`An edit textbox appears with the current text 'Buy milk'`);
  await agent.expect(`The textbox is focused`);

  await agent.perform(`Change the text to 'Buy organic milk' and press Enter`);
  await agent.expect(`The todo is updated to 'Buy organic milk'`);
  await agent.expect(`Edit mode is exited`);
  await agent.expect(`The updated text is displayed in the list`);
});
