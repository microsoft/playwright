import { test, expect } from '../playwright';
import App from '@/App';

test('navigate to a page by clicking a link', async ({ page, mount }) => {
  const component = await mount(<App />, {
    hooksConfig: { routing: true },
  });
  await expect(component.getByRole('main')).toHaveText('Login');
  await expect(page).toHaveURL('/');
  await component.getByRole('link', { name: 'Dashboard' }).click();
  await expect(component.getByRole('main')).toHaveText('Dashboard');
  await expect(page).toHaveURL('/dashboard');
});

test('update should not reset mount hooks', async ({ mount }) => {
  const component = await mount(<App title='before'/>, {
    hooksConfig: { routing: true },
  });
  await expect(component.getByRole('heading')).toHaveText('before');
  await expect(component.getByRole('main')).toHaveText('Login');

  await component.update(<App title='after'/>);
  await expect(component.getByRole('heading')).toHaveText('after');
  await expect(component.getByRole('main')).toHaveText('Login');
});
