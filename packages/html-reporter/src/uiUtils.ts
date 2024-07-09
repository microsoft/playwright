/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
import favIconExpected from '../logo_expected.svg';
import favIconDefault from '../logo_default.svg';
import favIconUnExpected from '../logo_unexpected.svg';
import favIconSkipped from '../logo_skipped.svg';
import favIconFlaky from '../logo_flaky.svg';
import type { TestCaseSummary } from './types';

export function msToString(ms: number): string {
  if (!isFinite(ms))
    return '-';

  if (ms === 0)
    return '0ms';

  if (ms < 1000)
    return ms.toFixed(0) + 'ms';

  const seconds = ms / 1000;
  if (seconds < 60)
    return seconds.toFixed(1) + 's';

  const minutes = seconds / 60;
  if (minutes < 60)
    return minutes.toFixed(1) + 'm';

  const hours = minutes / 60;
  if (hours < 24)
    return hours.toFixed(1) + 'h';

  const days = hours / 24;
  return days.toFixed(1) + 'd';
}

export function setFavIcon(outcome: Pick<TestCaseSummary, 'outcome'>) {
  const link: HTMLLinkElement | null = getLinkIconElement();
  const outcomeValue = outcome.outcome;

  if (outcomeValue === 'expected') {
    link.href = favIconExpected;
  } else if (outcomeValue === 'unexpected') {
    link.href = favIconUnExpected;
  } else if (outcomeValue === 'skipped') {
    link.href = favIconSkipped;
  } else if (outcomeValue === 'flaky') {
    link.href = favIconFlaky;
  } else {
    link.href = favIconDefault;
    document.title = 'Playwright Test Report | Summary';
  }
}

export function setDefaultFavIconAndTitle() {
  const link: HTMLLinkElement | null = getLinkIconElement();
  link.href = favIconDefault;
  document.title = 'Playwright Test Report | Summary';
}

function getLinkIconElement() {
  let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
  return link;
}