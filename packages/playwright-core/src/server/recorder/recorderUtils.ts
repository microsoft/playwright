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

import { renderSubtitleForCall, renderTitleForCall } from '@isomorphic/protocolFormatter';
import { raceAgainstDeadline } from '@isomorphic/timeoutRunner';
import { monotonicTime } from '@isomorphic/time';
import { quoteCSSAttributeValue } from '@isomorphic/stringUtils';
import { kAnyFrameSelector } from '@isomorphic/selectorParser';
import { isUnderTest } from '@utils/debug';
import { Frame } from '../frames';

import type { CallMetadata } from '../instrumentation';
import type { CallLog, CallLogStatus } from '@recorder/recorderTypes';
import type { Progress } from '../progress';
import type { Language } from '@isomorphic/locatorGenerators';

function buildFullSelector(framePath: string[], selector: string) {
  return [...framePath, selector].join(' >> internal:control=enter-frame >> ');
}

export async function buildFullSelectorForFrame(progress: Progress, frame: Frame, selector: string, timeout = isUnderTest() ? 10000 : 2000): Promise<string> {
  const framePath = await generateFrameSelector(progress, frame, timeout);
  const fullSelector = buildFullSelector(framePath, selector);
  // Starting from frameLocator() is only worth it when it saves at least two frameLocator(selector) calls.
  if (framePath.length < 2)
    return fullSelector;

  // Prefer the shortest selector that still pinpoints the target frame.
  const result = await progress.race(raceAgainstDeadline(async () => {
    for (let i = framePath.length; i >= 2; i--) {
      const candidate = kAnyFrameSelector + ' >> ' + buildFullSelector(framePath.slice(i), selector);
      if (await resolvesToFrame(progress, candidate, frame))
        return candidate;
    }
  }, monotonicTime() + timeout));
  if (!result.timedOut && result.result)
    return result.result;

  return fullSelector;
}

async function resolvesToFrame(progress: Progress, selector: string, frame: Frame): Promise<boolean> {
  try {
    const resolved = await progress.race(frame._page.mainFrame().selectors.callOnSelector(selector, { strict: false }, () => true, {}));
    return resolved?.frame === frame;
  } catch (e) {
    // Errors like "matched in multiple frames" mean the selector does not pinpoint the frame.
    return false;
  }
}

export function metadataToCallLog(metadata: CallMetadata, status: CallLogStatus, sdkLanguage: Language): CallLog {
  const title = renderTitleForCall(metadata, sdkLanguage);
  const subtitle = renderSubtitleForCall(metadata, sdkLanguage);
  if (metadata.error)
    status = 'error';
  let duration = metadata.endTime ? metadata.endTime - metadata.startTime : undefined;
  if (typeof duration === 'number' && metadata.pauseStartTime && metadata.pauseEndTime) {
    duration -= (metadata.pauseEndTime - metadata.pauseStartTime);
    duration = Math.max(duration, 0);
  }
  const callLog: CallLog = {
    id: metadata.id,
    messages: metadata.log,
    title: title ?? '',
    subtitle,
    status,
    error: metadata.error?.error?.message,
    duration,
  };
  return callLog;
}


async function generateFrameSelector(progress: Progress, frame: Frame, timeout: number): Promise<string[]> {
  const selectorPromises: Promise<string>[] = [];
  progress.setAllowConcurrentOrNestedRaces(true);
  while (frame) {
    const parent = frame.parentFrame();
    if (!parent)
      break;
    selectorPromises.push(generateFrameSelectorInParent(progress, parent, frame, timeout));
    frame = parent;
  }
  const result = await Promise.all(selectorPromises);
  progress.setAllowConcurrentOrNestedRaces(false);
  return result.reverse();
}

async function generateFrameSelectorInParent(prgoress: Progress, parent: Frame, frame: Frame, timeout: number): Promise<string> {
  const result = await raceAgainstDeadline(async () => {
    try {
      const frameElement = await frame.frameElement(prgoress);
      if (!frameElement || !parent)
        return;
      const utility = await parent.utilityContext();
      const injected = await utility.injectedScript();
      const selector = await injected.evaluate((injected, element) => {
        return injected.generateSelectorSimple(element as Element);
      }, frameElement);
      return selector;
    } catch (e) {
    }
  }, monotonicTime() + timeout);
  if (!result.timedOut && result.result)
    return result.result;

  if (frame.name())
    return `iframe[name=${quoteCSSAttributeValue(frame.name())}]`;
  return `iframe[src=${quoteCSSAttributeValue(frame.url())}]`;
}
