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

import { formatMatcherMessage, serializeExpectedTextValues, simpleMatcherUtils } from '../utils/expectUtils';
import { constructURLBasedOnBaseURL } from '../../utils/isomorphic/urlMatch';
import { parseRegex } from '../../utils/isomorphic/stringUtils';
import { monotonicTime } from '../../utils/isomorphic/time';
import { createGuid } from '../utils/crypto';
import { parseAriaSnapshotUnsafe } from '../../utils/isomorphic/ariaSnapshot';
import { asLocatorDescription } from '../../utils/isomorphic/locatorGenerators';
import { yaml } from '../../utilsBundle';
import { serializeError } from '../errors';

import type * as actions from './actions';
import type { Page } from '../page';
import type { Progress } from '../progress';
import type { NameValue } from '@protocol/channels';
import type { Frame } from '../frames';
import type { CallMetadata } from '../instrumentation';
import type * as channels from '@protocol/channels';
import type { FrameExpectParams } from '@injected/injectedScript';

export async function runAction(progress: Progress, mode: 'generate' | 'run', page: Page, action: actions.Action, secrets: NameValue[]) {
  const parentMetadata = progress.metadata;
  const frame = page.mainFrame();
  const callMetadata = callMetadataForAction(progress, frame, action, mode);
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
  // Disable auto-waiting to avoid timeouts, model has seen the snapshot anyway.
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
      await runExpect(frame, progress, mode, action.selector, { expression: 'to.be.visible', isNot: !!action.isNot }, 'visible', 'toBeVisible', '');
      break;
    }
    case 'expectValue': {
      if (action.type === 'textbox' || action.type === 'combobox' || action.type === 'slider') {
        const expectedText = serializeExpectedTextValues([action.value]);
        await runExpect(frame, progress, mode, action.selector, { expression: 'to.have.value', expectedText, isNot: !!action.isNot }, action.value, 'toHaveValue', 'expected');
      } else if (action.type === 'checkbox' || action.type === 'radio') {
        const expectedValue = { checked: action.value === 'true' };
        await runExpect(frame, progress, mode, action.selector, { selector: action.selector, expression: 'to.be.checked', expectedValue, isNot: !!action.isNot }, action.value ? 'checked' : 'unchecked', 'toBeChecked', '');
      } else {
        throw new Error(`Unsupported element type: ${action.type}`);
      }
      break;
    }
    case 'expectAria': {
      const expectedValue = parseAriaSnapshotUnsafe(yaml, action.template);
      await runExpect(frame, progress, mode, 'body', { expression: 'to.match.aria', expectedValue, isNot: !!action.isNot }, '\n' + action.template, 'toMatchAriaSnapshot', 'expected');
      break;
    }
    case 'expectURL': {
      if (!action.regex && !action.value)
        throw new Error('Either url or regex must be provided');
      if (action.regex && action.value)
        throw new Error('Only one of url or regex can be provided');
      const expected = action.regex ? parseRegex(action.regex) : constructURLBasedOnBaseURL(page.browserContext._options.baseURL, action.value!);
      const expectedText = serializeExpectedTextValues([expected]);
      await runExpect(frame, progress, mode, undefined, { expression: 'to.have.url', expectedText, isNot: !!action.isNot }, expected, 'toHaveURL', 'expected');
      break;
    }
  }
}

async function runExpect(frame: Frame, progress: Progress, mode: 'generate' | 'run', selector: string | undefined, options: FrameExpectParams, expected: string | RegExp, matcherName: string, expectation: string) {
  // Pass explicit timeout to limit the single expect action inside the overall "agentic expect" multi-step progress.
  const timeout = expectTimeout(mode);
  const result = await frame.expect(progress, selector, {
    ...options,
    timeoutForLogs: timeout,
    explicitTimeout: timeout,
    // Disable pre-checks to avoid them timing out, model has seen the snapshot anyway.
    noPreChecks: mode === 'generate',
  });
  if (!result.matches === !options.isNot) {
    const received = matcherName === 'toMatchAriaSnapshot' ? '\n' + result.received.raw : result.received;
    const expectedSuffix = typeof expected === 'string' ? '' : ' pattern';
    const expectedDisplay = typeof expected === 'string' ? expected : expected.toString();
    throw new Error(formatMatcherMessage(simpleMatcherUtils, {
      isNot: options.isNot,
      matcherName,
      expectation,
      locator: selector ? asLocatorDescription('javascript', selector) : undefined,
      timedOut: result.timedOut,
      timeout,
      printedExpected: options.isNot ? `Expected${expectedSuffix}: not ${expectedDisplay}` : `Expected${expectedSuffix}: ${expectedDisplay}`,
      printedReceived: result.errorMessage ? '' : `Received: ${received}`,
      errorMessage: result.errorMessage,
      // Note: we are not passing call log, because it will be automatically appended on the client side,
      // as a part of the agent.{perform,expect} call.
    }));
  }
}

export function traceParamsForAction(progress: Progress, action: actions.Action, mode: 'generate' | 'run'): { title?: string, type: string, method: string, params: any } {
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
          timeout: expectTimeout(mode),
        };
        return { type: 'Frame', method: 'expect', title: 'Expect Value', params };
      } else if (action.type === 'checkbox' || action.type === 'radio') {
        // TODO: provide serialized expected value
        const params: channels.FrameExpectParams = {
          selector: action.selector,
          expression: 'to.be.checked',
          isNot: !!action.isNot,
          timeout: expectTimeout(mode),
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
        timeout: expectTimeout(mode),
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
        timeout: expectTimeout(mode),
      };
      return { type: 'Frame', method: 'expect', title: 'Expect Aria Snapshot', params };
    }
    case 'expectURL': {
      const expected = action.regex ? parseRegex(action.regex) : action.value!;
      const expectedText = serializeExpectedTextValues([expected]);
      const params: channels.FrameExpectParams = {
        selector: undefined,
        expression: 'to.have.url',
        expectedText,
        isNot: !!action.isNot,
        timeout: expectTimeout(mode),
      };
      return { type: 'Frame', method: 'expect', title: 'Expect URL', params };
    }
  }
}

function callMetadataForAction(progress: Progress, frame: Frame, action: actions.Action, mode: 'generate' | 'run'): CallMetadata {
  const callMetadata: CallMetadata = {
    id: `call@${createGuid()}`,
    objectId: frame.guid,
    pageId: frame._page.guid,
    frameId: frame.guid,
    startTime: monotonicTime(),
    endTime: 0,
    log: [],
    ...traceParamsForAction(progress, action, mode),
  };
  return callMetadata;
}

function expectTimeout(mode: 'generate' | 'run') {
  return mode === 'generate' ? 0 : 5000;
}
