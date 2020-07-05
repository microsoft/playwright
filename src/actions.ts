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

import * as dom from './dom';
import * as frames from './frames';
import * as types from './types';
import { selectors } from './selectors';
import { Progress } from './progress';
import { ParsedSelector } from './common/selectorParser';
import { assert, helper } from './helper';

type ActionTarget = dom.ElementHandle | { frame: frames.Frame, selector: string };
type ParsedActionTarget = { target: dom.ElementHandle | ParsedSelector, world: types.World, frame: frames.Frame };

function parseActionTarget(target: ActionTarget): ParsedActionTarget {
  if (target instanceof dom.ElementHandle)
    return { target, world: 'utility', frame: target._context.frame };
  const selectorInfo = selectors._parseSelector(target.selector);
  return { target: selectorInfo.parsed, world: selectorInfo.world, frame: target.frame };
}

async function runTask<T>(progress: Progress, target: ParsedActionTarget, task: dom.SchedulableTask<T>): Promise<T> {
  if (target.target instanceof dom.ElementHandle) {
    const utility = await target.frame._context(target.world);
    const injectedScript = await utility.injectedScript();
    const poll = await task(injectedScript);
    const pollHandler = new dom.InjectedScriptPollHandler(progress, poll);
    return await pollHandler.finish();
  }
  return await target.frame._scheduleRerunnableTask(progress, target.world, task);
}

export async function fill(progress: Progress, target: ActionTarget, value: string, options: types.NavigatingActionWaitOptions): Promise<void> {
  assert(helper.isString(value), 'Value must be string. Found value "' + value + '" of type "' + (typeof value) + '"');

  if (target instanceof dom.ElementHandle)
    progress.logger.info(`  fill("${value}")`);
  else
    progress.logger.info(`  fill("${target.selector}", "${value}")`);

  const parsedTarget = parseActionTarget(target);
  const result = await runTask(progress, parsedTarget, injectedScript => {
    return injectedScript.evaluateHandle((injected, { target, value }) => {
      return injected.waitForEnabledAndFill(target, value);
    }, { target: parsedTarget.target, value });
  });
  const filled = dom.throwRetargetableDOMError(dom.throwFatalDOMError(result));

  if (filled === 'needsinput') {
    progress.throwIfAborted();  // Avoid action that has side-effects.
    return await parsedTarget.frame._page._frameManager.waitForSignalsCreatedBy(progress, options.noWaitAfter, async () => {
      if (value)
        await parsedTarget.frame._page.keyboard.insertText(value);
      else
        await parsedTarget.frame._page.keyboard.press('Delete');
    }, 'input');
  } else {
    dom.assertDone(filled);
  }
}

export async function textContent(progress: Progress, target: ActionTarget): Promise<string | null> {
  if (!(target instanceof dom.ElementHandle))
    progress.logger.info(`  retrieving textContent from "${target.selector}"`);
  const parsedTarget = parseActionTarget(target);
  const result = await runTask(progress, parsedTarget, injectedScript => {
    return injectedScript.evaluateHandle((injected, target) => {
      return injected.waitForNodeAndReturnTextContent(target);
    }, parsedTarget.target);
  });
  return result;
}

export async function innerText(progress: Progress, target: ActionTarget): Promise<string> {
  if (!(target instanceof dom.ElementHandle))
    progress.logger.info(`  retrieving innerText from "${target.selector}"`);
  const parsedTarget = parseActionTarget(target);
  const result = await runTask(progress, parsedTarget, injectedScript => {
    return injectedScript.evaluateHandle((injected, target) => {
      return injected.waitForNodeAndReturnInnerText(target);
    }, parsedTarget.target);
  });
  return dom.throwFatalDOMError(result).innerText;
}

export async function innerHTML(progress: Progress, target: ActionTarget): Promise<string> {
  if (!(target instanceof dom.ElementHandle))
    progress.logger.info(`  retrieving innerHTML from "${target.selector}"`);
  const parsedTarget = parseActionTarget(target);
  const result = await runTask(progress, parsedTarget, injectedScript => {
    return injectedScript.evaluateHandle((injected, target) => {
      return injected.waitForNodeAndReturnInnerHTML(target);
    }, parsedTarget.target);
  });
  return dom.throwFatalDOMError(result).innerHTML;
}

export async function getAttribute(progress: Progress, target: ActionTarget, name: string): Promise<string | null> {
  if (!(target instanceof dom.ElementHandle))
    progress.logger.info(`  retrieving attribute "${name}" from "${target.selector}"`);
  else
    progress.logger.info(`  retrieving attribute "${name}"`);
  const parsedTarget = parseActionTarget(target);
  const result = await runTask(progress, parsedTarget, injectedScript => {
    return injectedScript.evaluateHandle((injected, { target, name }) => {
      return injected.waitForNodeAndReturnAttribute(target, name);
    }, { target: parsedTarget.target, name });
  });
  return dom.throwFatalDOMError(result).value;
}

export async function dispatchEvent(progress: Progress, target: ActionTarget, type: string, eventInit: Object): Promise<void> {
  if (!(target instanceof dom.ElementHandle))
    progress.logger.info(`  dispatching event "${type}" on "${target.selector}"`);
  else
    progress.logger.info(`  dispatching event "${type}"`);
  const parsedTarget = parseActionTarget(target);
  parsedTarget.world = 'main';  // We always dispatch events in the main world.
  await runTask(progress, parsedTarget, injectedScript => {
    return injectedScript.evaluateHandle((injected, { target, type, eventInit }) => {
      return injected.waitForNodeAndDispatchEvent(target, type, eventInit);
    }, { target: parsedTarget.target, type, eventInit });
  });
}
