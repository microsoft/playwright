import { test } from '../../fixtures';

test('should show all todos with all filter', async ({ agent }) => {
  await agent.expect(`The page loads with an empty todo list`);

  await agent.perform(`Add three todos and mark one as complete`);
  await agent.expect(`Three todos exist, one completed and two active`);

  await agent.perform(`Navigate to the 'Active' filter by clicking on it`);
  await agent.expect(`Only active todos are visible`);

  await agent.perform(`Click on the 'All' filter link`);
  await agent.expect(`The URL changes to #/`);
  await agent.expect(`All todos (both completed and active) are displayed`);
  await agent.expect(`The 'All' filter link is highlighted`);
});
