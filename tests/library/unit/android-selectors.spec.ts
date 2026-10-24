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

import { test as it, expect } from '@playwright/test';
import { server as coreServer } from '../../../packages/playwright-core/lib/coreBundle';

const { normalizeSelector } = coreServer;

it('should normalize android selector with hasChild', () => {
  const input = {
    clazz: 'android.webkit.WebView',
    hasChild: {
      androidSelector: {
        text: '^Submit$',
      },
    },
  };
  const normalized = normalizeSelector(input);
  expect(normalized).toEqual({
    clazz: 'android.webkit.WebView',
    hasChild: {
      selector: {
        text: '^Submit$',
      },
    },
  });
});

it('should normalize android selector with hasDescendant and maxDepth', () => {
  const input = {
    clazz: 'android.webkit.WebView',
    hasDescendant: {
      androidSelector: {
        text: '^Submit$',
      },
      maxDepth: 20,
    },
  };
  const normalized = normalizeSelector(input);
  expect(normalized).toEqual({
    clazz: 'android.webkit.WebView',
    hasDescendant: {
      selector: {
        text: '^Submit$',
      },
      maxDepth: 20,
    },
    maxDepth: 20,
  });
});

it('should normalize deeply nested selectors', () => {
  const input = {
    hasChild: {
      androidSelector: {
        hasDescendant: {
          androidSelector: {
            text: 'nested',
          },
          maxDepth: 5,
        },
      },
    },
  };
  const normalized = normalizeSelector(input);
  expect(normalized).toEqual({
    hasChild: {
      selector: {
        hasDescendant: {
          selector: {
            text: 'nested',
          },
          maxDepth: 5,
        },
        maxDepth: 5,
      },
    },
  });
});
