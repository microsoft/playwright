import { test } from '../../fixtures';

test('should save edit on blur', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add a todo 'Call dentist'`);
  await agent.expect(`The todo appears in the list`);

  await agent.perform(`Double-click on the todo to enter edit mode`);
  await agent.expect(`Edit textbox appears`);

  await agent.perform(`Change the text to 'Schedule dentist appointment' and click elsewhere to blur the input`);
  await agent.expect(`The changes are saved`);
  await agent.expect(`The todo text is updated to 'Schedule dentist appointment'`);
  await agent.expect(`Edit mode is exited`);
});
