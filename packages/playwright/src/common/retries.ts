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

export type RetriesEntry = { count: number, condition?: RegExp };
export type SerializedRetriesEntry = { count: number, condition?: { source: string, flags: string } };

export function normalizeRetries(retries: number | RetriesEntry[]): RetriesEntry[] {
  if (typeof retries === 'number')
    return [{ count: retries }];
  return retries.map(entry => ({ ...entry }));
}

export function maxRetries(entries: RetriesEntry[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.count), 0);
}

export function computeRetries(entries: RetriesEntry[], errors: { message?: string }[]): number {
  const matching = entries.filter(entry => !entry.condition || errors.some(error => !!(error.message ?? '').match(entry.condition!)));
  return maxRetries(matching);
}

export function serializeRetries(entries: RetriesEntry[] | undefined): SerializedRetriesEntry[] | undefined {
  return entries?.map(entry => ({
    count: entry.count,
    ...(entry.condition ? { condition: { source: entry.condition.source, flags: entry.condition.flags } } : {}),
  }));
}

export function parseRetries(data: SerializedRetriesEntry[] | undefined): RetriesEntry[] | undefined {
  return data?.map(entry => ({
    count: entry.count,
    ...(entry.condition ? { condition: new RegExp(entry.condition.source, entry.condition.flags) } : {}),
  }));
}
