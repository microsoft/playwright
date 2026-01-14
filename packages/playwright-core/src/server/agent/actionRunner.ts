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
import { renderTitleForCall } from '../../utils/isomorphic/protocolFormatter';
import { ProgressController } from '../progress';
import { yaml } from '../../utilsBundle';
import { serializeError } from '../errors';

import type * as actions from './actions';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type { NameValue } from '@protocol/channels';
import type { ExpectResult, Frame } from '../frames';
import type { CallMetadata } from '../instrumentation';
import type * as channels from '@protocol/channels';

export async function runAction(parentProgress: Progress, mode: 'generate' | 'run', page: Page, action: actions.Action, secrets: NameValue[]) {
  const timeout = mode === 'generate' ? generateActionTimeout(action) : performActionTimeout(action);
  const mt = monotonicTime();
  const deadline = mt + timeout;
  const minDeadline = parentProgress.deadline ? Math.min(parentProgress.deadline, deadline) : deadline;
  const pc = new ProgressController();
  return await pc.run(async progress => {
    const frame = page.mainFrame();
    const callMetadata = callMetadataForAction(frame, action);
    await frame.instrumentation.onBeforeCall(frame, callMetadata, parentProgress.metadata.id);

    let error: Error | undefined;
    const result = await innerRunAction(progress, page, action, secrets).catch(e => error = e);
    callMetadata.endTime = monotonicTime();
    callMetadata.error = error ? serializeError(error) : undefined;
    callMetadata.result = error ? undefined : result;
    await frame.instrumentation.onAfterCall(frame, callMetadata);
    if (error)
      throw error;
    return result;
  }, minDeadline - mt);
}

async function innerRunAction(progress: Progress, page: Page, action: actions.Action, secrets: NameValue[]) {
  const frame = page.mainFrame();
  switch (action.method) {
    case 'navigate':
      await frame.goto(progress, action.url);
      break;
    case 'click':
      await frame.click(progress, action.selector, {
        button: action.button,
        clickCount: action.clickCount,
        modifiers: action.modifiers,
        ...strictTrue
      });
      break;
    case 'drag':
      await frame.dragAndDrop(progress, action.sourceSelector, action.targetSelector, { ...strictTrue });
      break;
    case 'hover':
      await frame.hover(progress, action.selector, {
        modifiers: action.modifiers,
        ...strictTrue
      });
      break;
    case 'selectOption':
      await frame.selectOption(progress, action.selector, [], action.labels.map(a => ({ label: a })), { ...strictTrue });
      break;
    case 'pressKey':
      await page.keyboard.press(progress, action.key);
      break;
    case 'pressSequentially': {
      const secret = secrets?.find(s => s.name === action.text)?.value ?? action.text;
      await frame.type(progress, action.selector, secret, { ...strictTrue });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
    }
    case 'fill': {
      const secret = secrets?.find(s => s.name === action.text)?.value ?? action.text;
      await frame.fill(progress, action.selector, secret, { ...strictTrue });
      if (action.submit)
        await page.keyboard.press(progress, 'Enter');
      break;
    }
    case 'setChecked':
      if (action.checked)
        await frame.check(progress, action.selector, { ...strictTrue });
      else
        await frame.uncheck(progress, action.selector, { ...strictTrue });
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

export function generateActionTimeout(action: actions.Action): number {
  switch (action.method) {
    case 'navigate':
      return 10000;
    case 'click':
    case 'drag':
    case 'hover':
    case 'selectOption':
    case 'pressKey':
    case 'pressSequentially':
    case 'fill':
    case 'setChecked':
      return 5000;
    case 'expectVisible':
    case 'expectValue':
    case 'expectAria':
      return 1;  // one shot
  }
}

export function performActionTimeout(action: actions.Action): number {
  switch (action.method) {
    case 'navigate':
    case 'click':
    case 'drag':
    case 'hover':
    case 'selectOption':
    case 'pressKey':
    case 'pressSequentially':
    case 'fill':
    case 'setChecked':
      return 0;  // no timeout
    case 'expectVisible':
    case 'expectValue':
    case 'expectAria':
      return 5000;  // default expect timeout.
  }
}

export function traceParamsForAction(action: actions.Action): { title?: string, type: string, method: string, params: any } {
  const timeout = generateActionTimeout(action);
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

function callMetadataForAction(frame: Frame, action: actions.Action): CallMetadata {
  const traceParams = traceParamsForAction(action);
  const title = renderTitleForCall(traceParams);

  const callMetadata: CallMetadata = {
    id: `call@${createGuid()}`,
    objectId: frame.guid,
    pageId: frame._page.guid,
    frameId: frame.guid,
    startTime: monotonicTime(),
    endTime: 0,
    type: 'Frame',
    method: traceParams.method,
    params: traceParams.params,
    title,
    log: [],
  };
  return callMetadata;
}

const kDefaultTimeout = 5000;
const strictTrue =  { strict: true };
