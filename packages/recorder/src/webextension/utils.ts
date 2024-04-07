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

export type RegisteredListener = {
  emitter: chrome.events.Event<any>;
  handler: (...args: any[]) => void;
};

class EventsHelper {
  static addEventListener<T extends(...args: any[]) => any>(emitter: chrome.events.Event<T>, handler: T) {
    emitter.addListener(handler);
    return { emitter, handler };
  }

  static removeEventListeners<T extends(...args: any[]) => any>(listeners: { emitter: chrome.events.Event<T>; handler: T}[]) {
    for (const { emitter, handler } of listeners)
      emitter.removeListener(handler);

  }
}

export const eventsHelper = EventsHelper;

const initialTime = Date.now();

export function monotonicTime(): number {
  return Date.now() - initialTime;
}

export async function raceAgainstDeadline<T>(cb: () => Promise<T>, deadline: number): Promise<{ result: T, timedOut: false } | { timedOut: true }> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    cb().then(result => {
      return { result, timedOut: false };
    }),
    new Promise<{ timedOut: true }>(resolve => {
      const kMaxDeadline = 2147483647; // 2^31-1
      const timeout = (deadline || kMaxDeadline) - monotonicTime();
      timer = setTimeout(() => resolve({ timedOut: true }), timeout);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}
