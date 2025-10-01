/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as actions from '@recorder/actions';

const { test, expect } = require('@playwright/test');
const Module = require('module');
const originalLoad = Module._load;
const utilsBundleStub = new Proxy({}, {
  get: () => ({})
});

Module._load = function(request: string, parent: any, isMain: boolean) {
  if (/BundleImpl$/.test(request) || /BundleImpl\.js$/.test(request))
    return utilsBundleStub;
  return originalLoad(request, parent, isMain);
};

const { JavaScriptLanguageGenerator } = require('../../../packages/playwright-core/src/server/codegen/javascript');
const { PythonLanguageGenerator } = require('../../../packages/playwright-core/src/server/codegen/python');
const { JavaLanguageGenerator } = require('../../../packages/playwright-core/src/server/codegen/java');
const { CSharpLanguageGenerator } = require('../../../packages/playwright-core/src/server/codegen/csharp');

const baseFrame: actions.FrameDescription = {
  pageGuid: 'page-guid',
  pageAlias: 'page',
  framePath: [],
};

function dragActionContext(overrides: Partial<actions.DragAndDropAction> = {}): actions.ActionInContext {
  const action: actions.DragAndDropAction = {
    name: 'dragAndDrop',
    selector: 'div.source',
    targetSelector: 'div.target',
    signals: [],
    sourcePosition: { x: 5, y: 10 },
    targetPosition: { x: 25, y: 40 },
    dragType: 'mouse',
    modifiers: 0,
    ...overrides,
  };

  return {
    frame: baseFrame,
    description: undefined,
    action,
    startTime: 0,
    endTime: 1,
  };
}

test.describe('recorder codegen drag-and-drop', () => {
  test('javascript uses locator.dragTo', () => {
    const generator = new JavaScriptLanguageGenerator(false);
    const code = generator.generateAction(dragActionContext());
    expect(code).toContain("page.locator('div.source').dragTo(page.locator('div.target')");
    expect(code).toContain('sourcePosition');
    expect(code).not.toContain('page.dragAndDrop(');
  });

  test('python uses locator.drag_to', () => {
    const generator = new PythonLanguageGenerator(false, false);
    const code = generator.generateAction(dragActionContext());
    expect(code).toContain('page.locator("div.source").drag_to(page.locator("div.target")');
    expect(code).toContain('source_position');
    expect(code).not.toContain('page.drag_and_drop(');
  });

  test('java uses locator.dragTo', () => {
    const generator = new JavaLanguageGenerator('library');
    const code = generator.generateAction(dragActionContext());
    expect(code).toContain('page.locator("div.source").dragTo(page.locator("div.target")');
    expect(code).toContain('Locator.DragToOptions');
    expect(code).not.toContain('page.dragAndDrop(');
  });

  test('csharp uses Locator.DragToAsync', () => {
    const generator = new CSharpLanguageGenerator('library');
    const code = generator.generateAction(dragActionContext());
    expect(code).toContain('page.Locator("div.source").DragToAsync(page.Locator("div.target")');
    expect(code).toContain('SourcePosition');
    expect(code).not.toContain('page.DragAndDropAsync(');
  });
});

test.afterAll(() => {
  Module._load = originalLoad;
});
