import { addDecorator } from '@storybook/react';
import '../src/web/common.css';
import { applyTheme } from '../src/web/theme';

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  viewport: {
    viewports: {
      recorder: {
        name: 'recorder',
        styles: {
          width: '800px',
          height: '600px',
        },
      },
      traceViewer: {
        name: 'traceViewer',
        styles: {
          width: '1024px',
          height: '768px',
        },
      },
    },
    defaultViewport: 'desktop'
  }
}

addDecorator(storyFn => {
  applyTheme();
  return <div style={{backgroundColor: 'var(--background)', display: 'flex', flex: 'auto'}}>
    {storyFn()}
  </div>
});
