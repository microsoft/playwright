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

import { serializeExpectedTextValues } from '../utils/expectUtils';
import { monotonicTime } from '../../utils/isomorphic/time';
import { createGuid } from '../utils/crypto';
import { parseAriaSnapshotUnsafe } from '../../utils/isomorphic/ariaSnapshot';
import { yaml } from '../../utilsBundle';
import { serializeError } from '../errors';

import type * as actions from './actions';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type { NameValue } from '@protocol/channels';
import type { ExpectResult, Frame } from '../frames';
import type { CallMetadata } from '../instrumentation';
import type * as channels from '@protocol/channels';

export async function runAction(progress: Progress, mode: 'generate' | 'run', page: Page, action: actions.Action, secrets: NameValue[]) {
  const parentMetadata = progress.metadata;
  const frame = page.mainFrame();
  const callMetadata = callMetadataForAction(progress, frame, action);
  callMetadata.log = parentMetadata.log;
  progress.metadata = callMetadata;

  await frame.instrumentation.onBeforeCall(frame, callMetadata, parentMetadata.id);
  let error: Error | undefined;
  const result = await innerRunAction(progress, mode, page, action, secrets).catch(e => error = e);
  callMetadata.endTime = monotonicTime();
  callMetadata.error = error ? serializeError(error) : undefined;
  callMetadata.result = error ? undefined : result;
  await frame.instrumentation.onAfterCall(frame, callMetadata);
  if (error)
    throw error;
  return result;
}

async function innerRunAction(progress: Progress, mode: 'generate' | 'run', page: Page, action: actions.Action, secrets: NameValue[]) {
  const frame = page.mainFrame();
  const commonOptions =  { strict: true, noAutoWaiting: mode === 'generate' };
  switch (action.method) {
    case 'navigate':
      await frame.goto(progress, action.url);
      break;
    case 'click':
      await frame.click(progress, action.selector, {
        button: action.button,
        clickCount: action.clickCount,
        modifiers: action.modifiers,
        ...commonOptions
      });
      break;
    case 'drag':
      await frame.dragAndDrop(progress, action.sourceSelector, action.targetSelector, { ...commonOptions });
      break;
    case 'hover':
      await frame.hover(progress, action.selector, {
        modifiers: action.modifiers,
        ...commonOptions
      });
      break;
    case 'selectOption':
      await frame.selectOption(progress, action.selector, [], action.labels.map(a => ({ label: a })), { ...commonOptions });
      break;
    case 'pressKey':
      await page.keyboard.press(progress, action.key);
      break;
    case 'pressSequentially': {
      const secret = secrets?.find(s => s.name === action.text)?.value ?? action.text;
      await frame.type(progress, action.selector, secret, { ...commonOptions });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
    }
    case 'fill': {
      const secret = secrets?.find(s => s.name === action.text)?.value ?? action.text;
      await frame.fill(progress, action.selector, secret, { ...commonOptions });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
    }
    case 'setChecked':
      if (action.checked)
        await frame.check(progress, action.selector, { ...commonOptions });
      else
        await frame.uncheck(progress, action.selector, { ...commonOptions });
      break;
    case 'expectVisible': {
      const result = await frame.expect(progress, action.selector, { expression: 'to.be.visible', isNot: !!action.isNot });
      if (!result.matches === !action.isNot)
        throw new Error(result.errorMessage);
      break;
    }
    case 'expectValue': {
      let result: ExpectResult;
      if (action.type === 'textbox' || action.type === 'combobox' || action.type === 'slider') {
        const expectedText = serializeExpectedTextValues([action.value]);
        result = await frame.expect(progress, action.selector, { expression: 'to.have.value', expectedText, isNot: !!action.isNot });
      } else if (action.type === 'checkbox' || action.type === 'radio') {
        const expectedValue = { checked: action.value === 'true' };
        result = await frame.expect(progress, action.selector, { selector: action.selector, expression: 'to.be.checked', expectedValue, isNot: !!action.isNot });
      } else {
        throw new Error(`Unsupported element type: ${action.type}`);
      }
      if (!result.matches === !action.isNot)
        throw new Error(result.errorMessage);
      break;
    }
    case 'expectAria': {
      const expectedValue = parseAriaSnapshotUnsafe(yaml, action.template);
      const result = await frame.expect(progress, 'body', { expression: 'to.match.aria', expectedValue, isNot: !!action.isNot });
      if (!result.matches === !action.isNot)
        throw new Error(result.errorMessage);
      break;
    }
  }
}

export function traceParamsForAction(progress: Progress, action: actions.Action): { title?: string, type: string, method: string, params: any } {
  const timeout = progress.timeout;
  switch (action.method) {
    case 'navigate': {
      const params: channels.FrameGotoParams = {
        url: action.url,
        timeout,
      };
      return { type: 'Frame', method: 'goto', params };
    }
    case 'click': {
      const params: channels.FrameClickParams = {
        selector: action.selector,
        strict: true,
        modifiers: action.modifiers,
        button: action.button,
        clickCount: action.clickCount,
        timeout,
      };
      return { type: 'Frame', method: 'click', params };
    }
    case 'drag': {
      const params: channels.FrameDragAndDropParams = {
        source: action.sourceSelector,
        target: action.targetSelector,
        timeout,
      };
      return { type: 'Frame', method: 'dragAndDrop', params };
    }
    case 'hover': {
      const params: channels.FrameHoverParams = {
        selector: action.selector,
        modifiers: action.modifiers,
        timeout,
      };
      return { type: 'Frame', method: 'hover', params };
    }
    case 'pressKey': {
      const params: channels.PageKeyboardPressParams = {
        key: action.key,
      };
      return { type: 'Page', method: 'keyboardPress', params };
    }
    case 'pressSequentially': {
      const params: channels.FrameTypeParams = {
        selector: action.selector,
        text: action.text,
        timeout,
      };
      return { type: 'Frame', method: 'type', params };
    }
    case 'fill': {
      const params: channels.FrameFillParams = {
        selector: action.selector,
        strict: true,
        value: action.text,
        timeout,
      };
      return { type: 'Frame', method: 'fill', params };
    }
    case 'setChecked': {
      if (action.checked) {
        const params: channels.FrameCheckParams = {
          selector: action.selector,
          strict: true,
          timeout,
        };
        return { type: 'Frame', method: 'check', params };
      } else {
        const params: channels.FrameUncheckParams = {
          selector: action.selector,
          strict: true,
          timeout,
        };
        return { type: 'Frame', method: 'uncheck', params };
      }
    }
    case 'selectOption': {
      const params: channels.FrameSelectOptionParams = {
        selector: action.selector,
        strict: true,
        options: action.labels.map(label => ({ label })),
        timeout,
      };
      return { type: 'Frame', method: 'selectOption', params };
    }
    case 'expectValue': {
      if (action.type === 'textbox' || action.type === 'combobox' || action.type === 'slider') {
        const expectedText = serializeExpectedTextValues([action.value]);
        const params: channels.FrameExpectParams = {
          selector: action.selector,
          expression: 'to.have.value',
          expectedText,
          isNot: !!action.isNot,
          timeout: kDefaultTimeout,
        };
        return { type: 'Frame', method: 'expect', title: 'Expect Value', params };
      } else if (action.type === 'checkbox' || action.type === 'radio') {
        // TODO: provide serialized expected value
        const params: channels.FrameExpectParams = {
          selector: action.selector,
          expression: 'to.be.checked',
          isNot: !!action.isNot,
          timeout: kDefaultTimeout,
        };
        return { type: 'Frame', method: 'expect', title: 'Expect Checked', params };
      } else {
        throw new Error(`Unsupported element type: ${action.type}`);
      }
    }
    case 'expectVisible': {
      const params: channels.FrameExpectParams = {
        selector: action.selector,
        expression: 'to.be.visible',
        isNot: !!action.isNot,
        timeout: kDefaultTimeout,
      };
      return { type: 'Frame', method: 'expect', title: 'Expect Visible', params };
    }
    case 'expectAria': {
      // TODO: provide serialized expected value
      const params: channels.FrameExpectParams = {
        selector: 'body',
        expression: 'to.match.snapshot',
        expectedText: [],
        isNot: !!action.isNot,
        timeout: kDefaultTimeout,
      };
      return { type: 'Frame', method: 'expect', title: 'Expect Aria Snapshot', params };
    }
  }
}

function callMetadataForAction(progress: Progress, frame: Frame, action: actions.Action): CallMetadata {
  const callMetadata: CallMetadata = {
    id: `call@${createGuid()}`,
    objectId: frame.guid,
    pageId: frame._page.guid,
    frameId: frame.guid,
    startTime: monotonicTime(),
    endTime: 0,
    log: [],
    ...traceParamsForAction(progress, action),
  };
  return callMetadata;
}

const kDefaultTimeout = 5000;
