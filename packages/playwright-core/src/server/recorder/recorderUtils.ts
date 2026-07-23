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

import { renderTitleForCall } from '@isomorphic/protocolFormatter';
import { raceAgainstDeadline } from '@isomorphic/timeoutRunner';
import { monotonicTime } from '@isomorphic/time';
import { quoteCSSAttributeValue } from '@isomorphic/stringUtils';
import { Frame } from '../frames';

import type { CallMetadata } from '../instrumentation';
import type { CallLog, CallLogStatus } from '@recorder/recorderTypes';
import type { Progress } from '../progress';

export function buildFullSelector(framePath: string[], selector: string) {
  return [...framePath, selector].join(' >> internal:control=enter-frame >> ');
}

export function metadataToCallLog(metadata: CallMetadata, status: CallLogStatus): CallLog {
  const title = renderTitleForCall(metadata);
  if (metadata.error)
    status = 'error';
  const params = {
    url: metadata.params?.url,
    selector: metadata.params?.selector,
  };
  let duration = metadata.endTime ? metadata.endTime - metadata.startTime : undefined;
  if (typeof duration === 'number' && metadata.pauseStartTime && metadata.pauseEndTime) {
    duration -= (metadata.pauseEndTime - metadata.pauseStartTime);
    duration = Math.max(duration, 0);
  }
  const callLog: CallLog = {
    id: metadata.id,
    messages: metadata.log,
    title: title ?? '',
    status,
    error: metadata.error?.error?.message,
    params,
    duration,
  };
  return callLog;
}


export async function generateFrameSelector(progress: Progress, frame: Frame): Promise<string[]> {
  const selectorPromises: Promise<string>[] = [];
  progress.setAllowConcurrentOrNestedRaces(true);
  while (frame) {
    const parent = frame.parentFrame();
    if (!parent)
      break;
    selectorPromises.push(generateFrameSelectorInParent(progress, parent, frame));
    frame = parent;
  }
  const result = await Promise.all(selectorPromises);
  progress.setAllowConcurrentOrNestedRaces(false);
  return result.reverse();
}

async function generateFrameSelectorInParent(prgoress: Progress, parent: Frame, frame: Frame): Promise<string> {
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
  }, monotonicTime() + 2000);
  if (!result.timedOut && result.result)
    return result.result;

  if (frame.name())
    return `iframe[name=${quoteCSSAttributeValue(frame.name())}]`;
  return `iframe[src=${quoteCSSAttributeValue(frame.url())}]`;
}
