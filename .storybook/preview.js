import { addDecorator } from '@storybook/react';
import { GlobalStyles } from '../src/cli/traceViewer/web/styles';
import { applyTheme } from '../src/cli/traceViewer/web/theme';

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
}


addDecorator(storyFn => {
  applyTheme();
  return <div style={{backgroundColor: 'var(--background)'}}>
    <GlobalStyles />
    {storyFn()}
  </div>
});
