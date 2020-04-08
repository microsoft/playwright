/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @param {Map<string, boolean>} apiCoverage
 * @param {Object} events
 * @param {string} className
 * @param {!Object} classType
 */
function traceAPICoverage(apiCoverage, events, className, classType) {
  className = className.substring(0, 1).toLowerCase() + className.substring(1);
  for (const methodName of Reflect.ownKeys(classType.prototype)) {
    const method = Reflect.get(classType.prototype, methodName);
    if (methodName === 'constructor' || typeof methodName !== 'string' || methodName.startsWith('_') || typeof method !== 'function')
      continue;
    apiCoverage.set(`${className}.${methodName}`, false);
    Reflect.set(classType.prototype, methodName, function(...args) {
      apiCoverage.set(`${className}.${methodName}`, true);
      return method.call(this, ...args);
    });
  }

  if (events[classType.name]) {
    for (const event of Object.values(events[classType.name])) {
      if (typeof event !== 'symbol')
        apiCoverage.set(`${className}.emit(${JSON.stringify(event)})`, false);
    }
    const method = Reflect.get(classType.prototype, 'emit');
    Reflect.set(classType.prototype, 'emit', function(event, ...args) {
      if (typeof event !== 'symbol' && this.listenerCount(event))
        apiCoverage.set(`${className}.emit(${JSON.stringify(event)})`, true);
      return method.call(this, event, ...args);
    });
  }
}

describe.skip(!process.env.COVERAGE)('**API COVERAGE**', () => {
  const BROWSER_CONFIGS = [
    {
      name: 'Firefox',
      events: require('../lib/events').Events,
      missingCoverage: ['browserContext.setGeolocation', 'browserContext.setOffline', 'cDPSession.send', 'cDPSession.detach'],
    },
    {
      name: 'WebKit',
      events: require('../lib/events').Events,
      missingCoverage: ['browserContext.clearPermissions', 'cDPSession.send', 'cDPSession.detach'],
    },
    {
      name: 'Chromium',
      events: {
        ...require('../lib/events').Events,
        ...require('../lib/chromium/events').Events,
      },
      missingCoverage: [],
    },
  ];
  const browserConfig = BROWSER_CONFIGS.find(config => config.name.toLowerCase() === browserType.name());
  const events = browserConfig.events;
  const api = require('../lib/api');

  const coverage = new Map();
  Object.keys(api).forEach(apiName => {
    if (BROWSER_CONFIGS.some(config => apiName.startsWith(config.name)) && !apiName.startsWith(browserConfig.name))
      return;
    traceAPICoverage(coverage, events, apiName, api[apiName]);
  });

  it('should call all API methods', () => {
    const ignoredMethods = new Set(browserConfig.missingCoverage);
    const missingMethods = [];
    const extraIgnoredMethods = [];
    for (const method of coverage.keys()) {
      // Sometimes we already have a background page while launching, before adding a listener.
      if (method === 'chromiumBrowserContext.emit("backgroundpage")')
        continue;
      if (!coverage.get(method) && !ignoredMethods.has(method))
        missingMethods.push(method);
      else if (coverage.get(method) && ignoredMethods.has(method))
        extraIgnoredMethods.push(method);
    }
    if (extraIgnoredMethods.length)
      throw new Error('Certain API Methods are called and should not be ignored: ' + extraIgnoredMethods.join(', '));
    if (missingMethods.length)
      throw new Error('Certain API Methods are not called: ' + missingMethods.join(', '));
  });
});
