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

import { z } from '../../../mcpBundle';
import { elementSchema } from './snapshot';
import { defineTabTool } from './tool';

const scrollSchema = elementSchema.extend({
  deltaX: z.number().default(0).describe('Horizontal scroll delta in pixels (positive = right)'),
  deltaY: z.number().default(0).describe('Vertical scroll delta in pixels (positive = down, negative = up)'),
});

const scroll = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_scroll',
    title: 'Scroll element',
    description: 'Scroll the nearest scrollable ancestor of an element. Unlike mouse wheel, this does not move the mouse pointer and will not trigger mouseleave events on hovered elements. Useful for testing scroll-dependent behavior like tooltip repositioning.',
    inputSchema: scrollSchema,
    type: 'input',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const { locator, resolved } = await tab.refLocator(params);

    response.addCode(`// Scroll nearest scrollable ancestor of ${params.element || 'element'}`);
    response.addCode(`await page.${resolved}.evaluate((el, [dx, dy]) => {`);
    response.addCode(`  let scrollable = el.parentElement;`);
    response.addCode(`  while (scrollable) {`);
    response.addCode(`    const style = window.getComputedStyle(scrollable);`);
    response.addCode(`    if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && scrollable.scrollHeight > scrollable.clientHeight) break;`);
    response.addCode(`    scrollable = scrollable.parentElement;`);
    response.addCode(`  }`);
    response.addCode(`  if (scrollable) { scrollable.scrollTop += dy; scrollable.scrollLeft += dx; }`);
    response.addCode(`}, [${params.deltaX}, ${params.deltaY}]);`);

    await locator.evaluate((el: HTMLElement, [dx, dy]: [number, number]) => {
      let scrollable: Element | null = el.parentElement;
      while (scrollable) {
        const style = window.getComputedStyle(scrollable);
        if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && scrollable.scrollHeight > scrollable.clientHeight)
          break;
        scrollable = scrollable.parentElement;
      }
      if (scrollable) {
        scrollable.scrollTop += dy;
        scrollable.scrollLeft += dx;
      }
    }, [params.deltaX, params.deltaY] as [number, number]);
  },
});

export default [scroll];
