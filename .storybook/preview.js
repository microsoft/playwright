import { addDecorator } from '@storybook/react';
import '../src/web/common.css';
import { applyTheme } from '../src/web/theme';

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
}

addDecorator(storyFn => {
  applyTheme();
  return <div style={{backgroundColor: 'var(--background)'}}>
    {storyFn()}
  </div>
});
