import { test } from '../../fixtures';

test('should cancel edit on escape', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Original text'`);
  await agent.expect(`The todo appears in the list`);

  await agent.perform(`Double-click on the todo to enter edit mode`);
  await agent.expect(`Edit textbox appears with 'Original text'`);

  await agent.perform(`Change the text to 'Modified text' but press Escape instead of Enter`);
  await agent.expect(`Edit mode is cancelled`);
  await agent.expect(`The todo text reverts to 'Original text'`);
  await agent.expect(`Changes are not saved`);
});
