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
import { test as it, expect } from './pageTest';

it('should work with aria-owns with elements outside the parent tree', async ({ page }) => {
  await page.setContent(`
    <div role="navigation" aria-owns="menu1 menu2">
      <div id="menu1" role="menu">
        <div role="menuitem">Home</div>
        <div role="menuitem">About</div>
      </div>
    </div>
    <div id="menu2" role="menu">
      <div role="menuitem">Services</div>
      <div role="menuitem">Contact</div>
    </div>
  `);

  const menuItem = page.getByRole('navigation').getByRole('menu', { ariaChildren: true }).getByRole('menuitem', { name: 'Services' });
  await expect.soft(menuItem).toHaveText(`Services`);
});

it('should work with aria-controls with elements outside the parent tree', async ({ page }) => {
  await page.setContent(`
    <form role="form" aria-controls="input1 input2">
      <label for="input1">First Name</label>
      <input id="input1" type="text">
    </form>
    <label for="input2">Last Name</label>
    <input id="input2" type="text">
  `);

  await page.getByRole('form').getByRole('textbox', { name: 'Last Name', ariaChildren: true }).fill('John');
});

it('should work with aria-owns and aria-controls with elements outside the parent tree', async ({ page }) => {
  await page.setContent(`
    <div role="main" aria-owns="section1 section2" aria-controls="footer">
      <section id="section1" role="region">
        <h2>Introduction</h2>
        <p>Welcome to our website.</p>
      </section>
    </div>
    <section id="section2" role="region">
      <h2>Features</h2>
      <ul>
        <li>Feature 1</li>
        <li>Feature 2</li>
      </ul>
    </section>
    <footer id="footer">
      <p>Contact us at info@example.com</p>
    </footer>
  `);

  await page.getByRole('main').getByRole('region', { ariaChildren: true }).getByRole('heading', { name: 'Features' }).click();
});

it('should work with nested roles with aria-owns', async ({ page }) => {
  await page.setContent(`
    <div role="tree" aria-owns="node1 node2">
      <div id="node1" role="treeitem">Node 1</div>
      <div id="node2" role="treeitem">Node 2</div>
    </div>
  `);

  const treeItem = page.getByRole('tree').getByRole('treeitem', { name: 'Node 1' });
  await expect(treeItem).toHaveText('Node 1');
});

it('should work with aria-controls with nested elements', async ({ page }) => {
  await page.setContent(`
    <div role="tablist" aria-controls="panel1 panel2">
      <div role="tab" id="tab1">Tab 1</div>
      <div role="tab" id="tab2">Tab 2</div>
    </div>
    <div id="panel1" role="tabpanel">Panel 1 Content</div>
    <div id="panel2" role="tabpanel">Panel 2 Content</div>
  `);

  const tabPanel = page.getByRole('tablist').getByRole('tabpanel', { ariaChildren: true }).getByText('Panel 1 Content');
  await expect(tabPanel).toHaveText('Panel 1 Content');
});

it('should work with aria-controls', async ({ page }) => {
  await page.setContent(`
    <div role="region">
      <button aria-controls="section1">Section 1</button>
      <button aria-controls="section2">Section 2</button>
    </div>
    <div id="section1" role="region">Section 1 Content</div>
    <div id="section2" role="region">Section 2 Content</div>
  `);

  const section = page.getByRole('region').getByRole('button', { name: 'Section 1' }).getByRole('region', { ariaChildren: true });
  await expect(section).toHaveText('Section 1 Content');
});

it('should work with aria-owns with mixed roles', async ({ page }) => {
  await page.setContent(`
    <div role="grid" aria-owns="row1 row2">
      <div id="row1" role="row">
        <div role="gridcell">Cell 1</div>
      </div>
      <div id="row2" role="row">
        <div role="gridcell">Cell 2</div>
      </div>
    </div>
  `);

  const gridCell = page.getByRole('grid').getByRole('gridcell', { name: 'Cell 1' });
  await expect(gridCell).toHaveText('Cell 1');
});


it('should work with aria-owns with role changes', async ({ page }) => {
  await page.setContent(`
    <div role="tablist" aria-owns="tab1 tab2">
      <div id="tab1" role="tab">Tab 1</div>
      <div id="tab2" role="tab">Tab 2</div>
    </div>
  `);

  const tab = page.getByRole('tablist').getByRole('tab', { name: 'Tab 1' });
  await expect(tab).toHaveText('Tab 1');
});
