import { test } from '../../fixtures';

test('should trim whitespace when editing', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Original task'`);
  await agent.expect(`The todo appears in the list`);

  await agent.perform(`Double-click to edit and change text to '   Edited task   ' (with leading and trailing spaces)`);
  await agent.expect(`Edit textbox shows the text with spaces`);

  await agent.perform(`Press Enter to save`);
  await agent.expect(`The todo is saved as 'Edited task' without leading or trailing whitespace`);
});
