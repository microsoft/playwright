/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect, playwrightCtConfigText } from '../playwright-test-fixtures';

test('should support Map and Set as props with complex values', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/component.tsx': `
      import React from 'react';

      export const TestComponent: React.FC<{ 
        mapProp: Map<string, { name: string, count: number }>, 
        setProp: Set<{ id: number, label: string }> 
      }> = ({ mapProp, setProp }) => {
        return (
          <div>
            <div data-testid="map-size">{mapProp.size}</div>
            <div data-testid="map-keys">{Array.from(mapProp.keys()).join(',')}</div>
            <div data-testid="map-values">
              {Array.from(mapProp.entries()).map(([key, value]) => 
                <div key={key} data-testid={\`map-value-\${String(key)}\`}>
                  {value.name}:{value.count}
                </div>
              )}
            </div>
            <div data-testid="set-size">{setProp.size}</div>
            <div data-testid="set-values">
              {Array.from(setProp).map((value, index) => 
                <div key={index} data-testid={\`set-value-\${index}\`}>
                  {value.id}:{value.label}
                </div>
              )}
            </div>
          </div>
        );
      };
    `,
    'src/component.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { TestComponent } from './component';

      test('should render with Map and Set props containing complex values', async ({ mount }) => {
        const map = new Map([
          ['item1', { name: 'Apple', count: 5 }],
          ['item2', { name: 'Banana', count: 3 }]
        ]);
        const set = new Set([
          { id: 1, label: 'First' },
          { id: 2, label: 'Second' }
        ]);
        
        const component = await mount(<TestComponent mapProp={map} setProp={set} />);
        
        await expect(component.getByTestId('map-size')).toHaveText('2');
        await expect(component.getByTestId('map-keys')).toHaveText('item1,item2');
        await expect(component.getByTestId('map-value-item1')).toHaveText('Apple:5');
        await expect(component.getByTestId('map-value-item2')).toHaveText('Banana:3');
        
        await expect(component.getByTestId('set-size')).toHaveText('2');
        await expect(component.getByTestId('set-value-0')).toHaveText('1:First');
        await expect(component.getByTestId('set-value-1')).toHaveText('2:Second');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support nested Map and Set as props', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/component.tsx': `
      import React from 'react';

      export const TestComponent: React.FC<{ 
        nestedMap: Map<string, Map<string, number>>, 
        nestedSet: Set<Set<string>> 
      }> = ({ nestedMap, nestedSet }) => {
        return (
          <div>
            <div data-testid="nested-map-size">{nestedMap.size}</div>
            <div data-testid="nested-map-keys">{Array.from(nestedMap.keys()).join(',')}</div>
            <div data-testid="nested-set-size">{nestedSet.size}</div>
          </div>
        );
      };
    `,
    'src/component.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { TestComponent } from './component';

      test('should render with nested Map and Set props', async ({ mount }) => {
        const nestedMap = new Map([
          ['group1', new Map([['a', 1], ['b', 2]])],
          ['group2', new Map([['c', 3], ['d', 4]])]
        ]);
        const nestedSet = new Set([
          new Set(['x', 'y']),
          new Set(['z', 'w'])
        ]);
        
        const component = await mount(<TestComponent nestedMap={nestedMap} nestedSet={nestedSet} />);
        
        await expect(component.getByTestId('nested-map-size')).toHaveText('2');
        await expect(component.getByTestId('nested-map-keys')).toHaveText('group1,group2');
        await expect(component.getByTestId('nested-set-size')).toHaveText('2');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});